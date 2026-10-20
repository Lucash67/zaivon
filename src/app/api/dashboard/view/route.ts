import { format, parseISO } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { buildDashboardView, enrichDiaryContext } from "@/lib/dashboard-view";
import { generateDiaryAutoInsights } from "@/lib/diary-auto-insights";
import { getDiaryEntry } from "@/lib/diary-service";
import { getSmartGoalsView } from "@/lib/smart-goals-service";
import { buildOperationalDayMetrics, sortOperationalDays } from "@/lib/operational-day-metrics";
import { buildWeekPulse } from "@/lib/week-pulse";
import { buildConservativeWeekForecast } from "@/lib/conservative-week-forecast";
import { isAllBusinesses } from "@/lib/business-units";
import { listDailyPurchaseMixByDate } from "@/lib/operational-data-service";
import { fetchMetricGoals } from "@/platform/db/data-access/metrics";
import { listSalesEnriched } from "@/platform/db/repositories/sale-repository";
import type { TemporalViewContext, TemporalViewMode } from "@/stores/temporal-context-store";
import { MSG, apiError } from "@/shared/api-messages";
import { isAuthFailure, requireApiSession } from "@/lib/auth/require-api-session";
import { withTenantScope } from "@/lib/auth/with-tenant-api";
import { ensureSalgadosProfitGoals } from "@/lib/goals-service";
import {
  SALGADOS_DAILY_PROFIT_GOAL,
  SALGADOS_DAILY_UNITS_GOAL,
  SALGADOS_WEEKLY_PROFIT_GOAL,
  usesSalgadosProfitGoals,
} from "@/lib/salgados-profit-goals";
import { buildZaivonPulse } from "@/lib/zaivon-pulse";
import { sumPendingRevenue, sumProfit, sumReceivedRevenue, sumRevenue } from "@/lib/analytics-engine/client";

function isSunday(dateKey: string): boolean {
  return parseISO(dateKey).getDay() === 0;
}

function isISODate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeDashboardSales(
  sales: Awaited<ReturnType<typeof listSalesEnriched>>,
) {
  return sales.map((sale) => ({
    ...sale,
    paymentMethod: sale.paymentMethod ?? "",
  }));
}

function parseViewContext(params: URLSearchParams): TemporalViewContext {
  const rawMode = params.get("viewMode");
  const mode: TemporalViewMode =
    rawMode === "day" ? "day" : rawMode === "range" ? "range" : "general";
  const today = format(new Date(), "yyyy-MM-dd");
  const viewDate = isISODate(params.get("date")) ? params.get("date")! : today;
  let dateFrom = isISODate(params.get("dateFrom")) ? params.get("dateFrom")! : today;
  let dateTo = isISODate(params.get("dateTo")) ? params.get("dateTo")! : today;
  if (dateFrom > dateTo) {
    const swap = dateFrom;
    dateFrom = dateTo;
    dateTo = swap;
  }
  return { mode, viewDate, dateFrom, dateTo };
}

export async function GET(request: NextRequest) {
  const auth = await requireApiSession();
  if (isAuthFailure(auth)) return auth;
  try {
    return await withTenantScope(auth, request.nextUrl.searchParams.get("businessId"), async (scope) => {
      const params = request.nextUrl.searchParams;
      const businessId = scope.businessId;
      const context = parseViewContext(params);
      const { mode: viewMode, viewDate, dateFrom, dateTo } = context;

      const [sales, goals, purchasesByDate] = await Promise.all([
        listSalesEnriched(businessId),
        fetchMetricGoals(businessId),
        listDailyPurchaseMixByDate(businessId).catch(() => ({})),
      ]);

      if (usesSalgadosProfitGoals(businessId)) {
        await ensureSalgadosProfitGoals().catch((error) => {
          console.error("ensureSalgadosProfitGoals:", error);
        });
      }

      let dailyGoal = goals.find((g) => g.type === "daily")?.targetAmount ?? 0;
      let weeklyGoal = goals.find((g) => g.type === "weekly")?.targetAmount ?? 0;
      let dailyUnitsGoal = goals.find((g) => g.type === "daily")?.targetUnits ?? 0;

      // Salgados (e visão Todos): meta canônica de lucro + unidades.
      if (usesSalgadosProfitGoals(businessId)) {
        dailyGoal = SALGADOS_DAILY_PROFIT_GOAL;
        weeklyGoal = SALGADOS_WEEKLY_PROFIT_GOAL;
        dailyUnitsGoal = SALGADOS_DAILY_UNITS_GOAL;
      }

      // Base diário-primeiro: alimenta o resumo da semana nas duas visões.
      const metricsMap = await buildOperationalDayMetrics(businessId).catch(() => null);
      const dayMetrics = metricsMap ? sortOperationalDays(metricsMap) : null;

      const weekPulseOptions = {
        goalRevenue: weeklyGoal,
        dailyProfitGoal: usesSalgadosProfitGoals(businessId)
          ? SALGADOS_DAILY_PROFIT_GOAL
          : undefined,
        dailyUnitsGoal: usesSalgadosProfitGoals(businessId)
          ? SALGADOS_DAILY_UNITS_GOAL
          : dailyUnitsGoal > 0
            ? dailyUnitsGoal
            : undefined,
        allowFallback: true as const,
        sales,
        purchasesByDate,
      };

      let diaryEntry = null;
      let autoInsights: Awaited<ReturnType<typeof generateDiaryAutoInsights>> = [];

      if (viewMode === "day" && !isAllBusinesses(businessId)) {
        const [entry, smartGoals, insights] = await Promise.all([
          getDiaryEntry(businessId, viewDate),
          getSmartGoalsView(businessId, viewDate),
          generateDiaryAutoInsights(businessId, viewDate),
        ]);
        diaryEntry = entry;
        autoInsights = insights;
        if (dailyGoal <= 0 && !usesSalgadosProfitGoals(businessId)) {
          dailyGoal = smartGoals?.daily.targetRevenue ?? 0;
        }
        if (weeklyGoal <= 0 && !usesSalgadosProfitGoals(businessId)) {
          weeklyGoal = smartGoals?.weekly.targetRevenue ?? 0;
        }
        if (dailyUnitsGoal <= 0 && !usesSalgadosProfitGoals(businessId)) {
          dailyUnitsGoal = smartGoals?.daily.targetUnits ?? 0;
        }
        const diaryContext = enrichDiaryContext(entry, smartGoals?.daily?.targetUnits);
        const data = buildDashboardView(
          normalizeDashboardSales(sales),
          context,
          0,
          dailyGoal,
          0,
          diaryContext,
          businessId,
          dayMetrics,
          dailyUnitsGoal,
        );
        // Garante perdas do diário no card mesmo se o resumo vier desalinhado.
        if (data.daySummary && entry) {
          data.daySummary.losses = Math.max(
            data.daySummary.losses,
            Number(entry.quantityLost) || 0,
          );
        }
        const todayKey = format(new Date(), "yyyy-MM-dd");
        const pulse = buildZaivonPulse({
          focusDate: viewDate,
          isToday: viewDate === todayKey,
          diary: diaryEntry,
          fallback: {
            revenue: data.metrics.revenueToday,
            profit: data.metrics.profitToday,
            cashIn: data.metrics.revenueToday,
            newCredit: diaryEntry?.revenue?.pending ?? null,
          },
        });

        return NextResponse.json({
          data,
          diaryEntry,
          autoInsights,
          pulse,
          weekPulse: dayMetrics
            ? buildWeekPulse(dayMetrics, viewDate, {
                ...weekPulseOptions,
                goalRevenue: weeklyGoal,
              })
            : null,
          conservativeWeek:
            isSunday(viewDate) && dayMetrics
              ? buildConservativeWeekForecast(dayMetrics, viewDate, businessId)
              : null,
          context: { mode: viewMode, viewDate, dateFrom, dateTo },
        });
      }

      // Visão geral / período: smart só para negócios sem meta canônica de lucro.
      if (
        (dailyGoal <= 0 || weeklyGoal <= 0 || dailyUnitsGoal <= 0) &&
        !isAllBusinesses(businessId) &&
        !usesSalgadosProfitGoals(businessId)
      ) {
        const smartGoals = await getSmartGoalsView(businessId).catch(() => null);
        if (dailyGoal <= 0) dailyGoal = smartGoals?.daily.targetRevenue ?? 0;
        if (weeklyGoal <= 0) weeklyGoal = smartGoals?.weekly.targetRevenue ?? 0;
        if (dailyUnitsGoal <= 0) dailyUnitsGoal = smartGoals?.daily.targetUnits ?? 0;
      }
      const data = buildDashboardView(
        normalizeDashboardSales(sales),
        context,
        0,
        dailyGoal,
        0,
        null,
        businessId,
        dayMetrics,
        dailyUnitsGoal,
      );
      const pulseDate =
        viewMode === "day" ? viewDate : viewMode === "range" ? dateTo : format(new Date(), "yyyy-MM-dd");

      // Pulse: diário do dia-âncora (hoje / fim do range). Sem diário, usa só vendas daquele dia.
      let pulseDiary = null;
      if (!isAllBusinesses(businessId)) {
        pulseDiary = await getDiaryEntry(businessId, pulseDate).catch(() => null);
      }
      const daySalesForPulse = sales.filter((s) => s.date === pulseDate);
      const pulseSaleRows = daySalesForPulse.map((s) => ({
        totalAmount: Number(s.totalAmount) || 0,
        profit: Number(s.profit) || 0,
        paymentStatus: s.paymentStatus,
        amountReceived: s.amountReceived != null ? Number(s.amountReceived) : null,
      }));
      const pulse = buildZaivonPulse({
        focusDate: pulseDate,
        isToday: pulseDate === format(new Date(), "yyyy-MM-dd"),
        diary: pulseDiary,
        fallback: {
          revenue: sumRevenue(pulseSaleRows),
          profit: sumProfit(pulseSaleRows),
          cashIn: sumReceivedRevenue(pulseSaleRows),
          newCredit: sumPendingRevenue(pulseSaleRows),
        },
      });

      return NextResponse.json({
        data,
        diaryEntry: null,
        autoInsights: [],
        pulse,
        weekPulse: dayMetrics
          ? buildWeekPulse(dayMetrics, pulseDate, {
              ...weekPulseOptions,
              goalRevenue: weeklyGoal,
            })
          : null,
        conservativeWeek:
          isSunday(pulseDate) && dayMetrics
            ? buildConservativeWeekForecast(
                dayMetrics,
                pulseDate,
                isAllBusinesses(businessId) ? "salgados" : businessId,
              )
            : null,
        context: { mode: viewMode, viewDate, dateFrom, dateTo },
      });
    });
  } catch (error) {
    console.error("Dashboard view GET error:", error);
    return apiError(MSG.LOAD_DASHBOARD);
  }
}
