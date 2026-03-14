namespace Pocketfolio.Api.Entities;

public class Setting : ITenantEntity
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
}
