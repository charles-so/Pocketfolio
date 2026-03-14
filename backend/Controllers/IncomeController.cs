using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Dtos;
using Pocketfolio.Api.Entities;
using Pocketfolio.Api.Services;

namespace Pocketfolio.Api.Controllers;

[ApiController]
[Route("api/income")]
public class IncomeController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly BudgetEngine _engine;

    public IncomeController(AppDbContext db, BudgetEngine engine)
    {
        _db = db;
        _engine = engine;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int? period)
    {
        int periodNum;
        if (period.HasValue)
            periodNum = Math.Max(period.Value, 1);
        else
        {
            var (p, _, _) = _engine.PeriodForDate(DateTime.Today);
            periodNum = Math.Max(p, 1);
        }

        var start = _engine.CycleStart.AddDays((periodNum - 1) * 14);
        var end = start.AddDays(13);

        var records = await _db.Incomes
            .Where(i => i.Date >= start && i.Date <= end)
            .OrderByDescending(i => i.Date)
            .ThenByDescending(i => i.Id)
            .Select(i => new IncomeRecordDto(
                i.Id, i.Amount, i.Date.ToString("yyyy-MM-dd"), i.Type, i.Description))
            .ToListAsync();

        return Ok(new { records });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateIncomeRequest req)
    {
        if (!DateTime.TryParse(req.Date, out var date))
            return BadRequest(new { error = "Invalid date." });
        if (req.Amount <= 0)
            return BadRequest(new { error = "Amount must be positive." });

        var validTypes = new[] { "Paycheck", "StockSale", "Bonus" };
        if (!validTypes.Contains(req.Type))
            return BadRequest(new { error = "Type must be Paycheck, StockSale, or Bonus." });

        var income = new Income
        {
            Amount = Math.Round(req.Amount, 2),
            Date = date,
            Type = req.Type,
            Description = req.Description?.Trim() ?? string.Empty,
        };

        _db.Incomes.Add(income);
        await _db.SaveChangesAsync();

        return Ok(new { ok = true, id = income.Id });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateIncomeRequest req)
    {
        var income = await _db.Incomes.FindAsync(id);
        if (income == null) return NotFound(new { error = "Income record not found." });

        if (!DateTime.TryParse(req.Date, out var date))
            return BadRequest(new { error = "Invalid date." });
        if (req.Amount <= 0)
            return BadRequest(new { error = "Amount must be positive." });

        income.Amount = Math.Round(req.Amount, 2);
        income.Date = date;
        income.Type = req.Type;
        income.Description = req.Description?.Trim() ?? string.Empty;

        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var income = await _db.Incomes.FindAsync(id);
        if (income == null) return NotFound(new { error = "Income record not found." });

        _db.Incomes.Remove(income);
        await _db.SaveChangesAsync();
        return Ok(new { ok = true });
    }
}
