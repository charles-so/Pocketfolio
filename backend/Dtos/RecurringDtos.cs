namespace Pocketfolio.Api.Dtos;

public record CreateRecurringRequest(
    string Type,        // "Income" or "Expense"
    decimal Amount,
    string? Description,
    int? EnvelopeId,    // required for Expense
    string? IncomeType, // required for Income ("Paycheck", "Bonus")
    string StartDate,   // yyyy-MM-dd
    string Frequency    // "Fortnightly", "Monthly", "Quarterly", "Yearly"
);

public record RecurringItemDto(
    int Id,
    string Type,
    decimal Amount,
    string Description,
    int? EnvelopeId,
    string? EnvelopeName,
    string? EnvelopeGroupName,
    string? IncomeType,
    string StartDate,
    string Frequency,
    bool Active,
    string? LastAppliedDate,
    string? NextDate
);

public record PendingRecurringItemDto(
    int RecurringItemId,
    string Type,
    decimal Amount,
    string Description,
    int? EnvelopeId,
    string? EnvelopeName,
    string? IncomeType,
    string DueDate,
    string Frequency
);

public record UpdateRecurringRequest(
    decimal Amount,
    string? Description,
    int? EnvelopeId,
    string? IncomeType,
    string Frequency
);

public record ConfirmRecurringRequest(
    int RecurringItemId,
    string DueDate
);
