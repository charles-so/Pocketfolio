namespace Pocketfolio.Api.Dtos;

public record CreateIncomeRequest(string Date, decimal Amount, string Type, string? Description);

public record UpdateIncomeRequest(string Date, decimal Amount, string Type, string? Description);

public record IncomeRecordDto(
    int Id,
    decimal Amount,
    string Date,
    string Type,
    string Description);
