using Microsoft.EntityFrameworkCore;
using Pocketfolio.Api.Data;
using Pocketfolio.Api.Entities;

namespace Pocketfolio.Api.Services;

public class TickerDirectoryService
{
    private readonly AppDbContext _db;

    public TickerDirectoryService(AppDbContext db)
    {
        _db = db;
    }

    public async Task ReloadAsync(List<(string Ticker, string Name, string Exchange)> tickers)
    {
        await _db.TickerDirectory.ExecuteDeleteAsync();

        foreach (var (ticker, name, exchange) in tickers)
        {
            _db.TickerDirectory.Add(new TickerEntry
            {
                Ticker = ticker,
                Name = name,
                Exchange = exchange,
            });
        }
        await _db.SaveChangesAsync();
    }

    public async Task<List<TickerSearchResult>> SearchAsync(string query, int limit = 20)
    {
        var q = query.ToUpper();
        var pattern = $"%{q}%";
        var prefixPattern = $"{q}%";

        return await _db.TickerDirectory
            .Where(t => EF.Functions.Like(t.Ticker, pattern) || EF.Functions.Like(t.Name, pattern))
            .OrderBy(t => EF.Functions.Like(t.Ticker, prefixPattern) ? 0 : 1)
            .ThenBy(t => t.Ticker)
            .Take(limit)
            .Select(t => new TickerSearchResult
            {
                Ticker = t.Ticker,
                Name = t.Name,
                Exchange = t.Exchange,
            })
            .ToListAsync();
    }

    public async Task<int> GetCountAsync()
    {
        return await _db.TickerDirectory.CountAsync();
    }
}
