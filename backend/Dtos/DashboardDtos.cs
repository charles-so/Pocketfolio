namespace Pocketfolio.Api.Dtos;

public record DashboardResponse(
    int Period,
    string PeriodStart,
    string PeriodEnd,
    string PeriodLabel,
    decimal TotalBudget,
    decimal TotalSpent,
    decimal TotalAvailable,
    List<GroupDto> Groups,
    InvestmentsSummaryDto Investments,
    IncomeSummaryDto Income);

public record GroupDto(
    string Name,
    decimal BudgetFn,
    decimal Spent,
    decimal Available,
    List<EnvelopeStatusDto> Envelopes);

public record EnvelopeStatusDto(
    int Id,
    string Name,
    decimal BudgetFn,
    decimal Spent,
    decimal Rollover,
    decimal Available,
    decimal Bonus,
    string? Ticker,
    string GroupName,
    decimal? InvestmentCash);

public record InvestmentsSummaryDto(
    decimal TotalBudgetFn,
    decimal TotalRollover,
    decimal TotalDeposited,
    decimal TotalCashToInvest,
    List<InvestmentEnvelopeDto> Envelopes);

public record InvestmentEnvelopeDto(
    int Id,
    string Name,
    string? Ticker,
    decimal BudgetFn,
    decimal CumulativeBudget,
    decimal Rollover,
    decimal Deposited,
    decimal CashToInvest,
    decimal Bonus);

public record IncomeSummaryDto(
    decimal PeriodIncome,
    decimal CumulativeIncome,
    decimal Remaining,
    decimal CumulativeRemaining,
    List<IncomeRecordDto> Records);
