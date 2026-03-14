namespace Pocketfolio.Api.Dtos;

public record CreateEnvelopeRequest(string Name, string GroupName, decimal BudgetFn, string? Ticker);

public record UpdateEnvelopeRequest(string Name, string GroupName);

public record UpdateBudgetRequest(decimal BudgetFn);

public record EnvelopeDetailResponse(
    int Id, string Name, string GroupName, decimal BudgetFn, string? Ticker,
    EnvelopeStatsDto Stats,
    List<EnvelopeTransactionDto> Transactions);

public record EnvelopeStatsDto(
    decimal TotalSpent, decimal AvgPerPeriod, decimal AvgPerTransaction,
    int TransactionCount, decimal CurrentPeriodSpent, decimal LastPeriodSpent,
    TransactionHighlightDto? Highest, TransactionHighlightDto? Lowest);

public record TransactionHighlightDto(decimal Amount, string Description, string Date);

public record EnvelopeTransactionDto(int Id, string Date, decimal Amount, string Description, int AttachmentCount, string? AttachmentName);
