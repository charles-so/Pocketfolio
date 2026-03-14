using Microsoft.AspNetCore.Mvc;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Dtos;
using Pocketfolio.Api.Entities;

namespace Pocketfolio.Api.Controllers;

[ApiController]
[Route("api/settings")]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _db;

    public SettingsController(AppDbContext db) => _db = db;

    [HttpPost]
    public IActionResult Save([FromBody] SaveSettingsRequest req)
    {
        if (!DateTime.TryParse(req.PayCycleStart, out _))
            return BadRequest(new { error = "Invalid date. Use YYYY-MM-DD." });

        Upsert("pay_cycle_start", req.PayCycleStart);
        _db.SaveChanges();

        return Ok(new { ok = true });
    }

    private void Upsert(string key, string value)
    {
        var setting = _db.Settings.FirstOrDefault(s => s.Key == key);
        if (setting != null)
            setting.Value = value;
        else
            _db.Settings.Add(new Setting { Key = key, Value = value });
    }
}
