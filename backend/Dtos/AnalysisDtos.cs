namespace Pocketfolio.Api.Dtos;

public record AnalysisResponse(
    decimal TotalSpent,
    decimal ThisPeriodSpent,
    decimal LastPeriodSpent,
    decimal AvgPerPeriod,
    int TransactionCount,
    decimal TotalIncome,
    decimal ThisPeriodIncome,
    decimal LastPeriodIncome,
    decimal AvgIncomePerPeriod,
    List<GroupSpendingDto> ByGroup,
    List<IncomeByTypeDto> IncomeByType,
    List<EnvelopeSpendingDto> TopEnvelopes,
    List<TrendPointDto> Trend,
    List<TrendPointDto> IncomeTrend,
    List<BudgetVsActualDto> BudgetVsActual,
    List<InvestmentSummaryDto> InvestmentSummary,
    List<string> AvailableGroups,
    List<FilterEnvelopeDto> AvailableEnvelopes);

public record IncomeByTypeDto(string Type, decimal Total);

public record GroupSpendingDto(string GroupName, decimal Total);

public record EnvelopeSpendingDto(int Id, string Name, string GroupName, decimal Total);

public record TrendPointDto(int Period, string Label, decimal Total);

public record BudgetVsActualDto(string Name, string Group, decimal Budget, decimal Actual);

public record FilterEnvelopeDto(int Id, string Name, string GroupName);
