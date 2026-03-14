using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Caching.Memory;

namespace Pocketfolio.Api.Services;

public class YahooFinanceService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromMinutes(15);

    // Crumb/cookie auth for quoteSummary endpoint
    private string? _crumb;
    private string? _cookieHeader;
    private DateTime _crumbExpiry = DateTime.MinValue;
    private readonly SemaphoreSlim _crumbLock = new(1, 1);

    public YahooFinanceService(IHttpClientFactory httpFactory, IMemoryCache cache)
    {
        _httpFactory = httpFactory;
        _cache = cache;
    }

    private async Task EnsureCrumbAsync()
    {
        if (_crumb != null && DateTime.UtcNow < _crumbExpiry)
            return;

        await _crumbLock.WaitAsync();
        try
        {
            if (_crumb != null && DateTime.UtcNow < _crumbExpiry)
                return;

            var handler = new HttpClientHandler
            {
                CookieContainer = new CookieContainer(),
                UseCookies = true
            };
            using var client = new HttpClient(handler);
            client.DefaultRequestHeaders.UserAgent.ParseAdd(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

            // Get consent cookie
            await client.GetAsync("https://fc.yahoo.com/");

            // Get crumb
            _crumb = await client.GetStringAsync("https://query2.finance.yahoo.com/v1/test/getcrumb");

            // Extract cookies for future requests
            var cookies = handler.CookieContainer.GetCookies(new Uri("https://query2.finance.yahoo.com"));
            _cookieHeader = string.Join("; ", cookies.Cast<Cookie>().Select(c => $"{c.Name}={c.Value}"));

            _crumbExpiry = DateTime.UtcNow.AddMinutes(30);
        }
        finally
        {
            _crumbLock.Release();
        }
    }

    public async Task<QuoteData> GetQuoteAsync(string ticker, bool forceRefresh = false)
    {
        string cacheKey = $"yf_quote_{ticker}";
        if (!forceRefresh && _cache.TryGetValue(cacheKey, out QuoteData? cached))
            return cached!;

        var client = _httpFactory.CreateClient("YahooFinance");
        try
        {
            var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{Uri.EscapeDataString(ticker)}?interval=1d&range=5d";
            var response = await client.GetStringAsync(url);
            var doc = JsonDocument.Parse(response);
            var result = doc.RootElement.GetProperty("chart").GetProperty("result")[0];
            var meta = result.GetProperty("meta");

            var price = meta.TryGetProperty("regularMarketPrice", out var p) ? p.GetDecimal() : 0m;
            var name = meta.TryGetProperty("shortName", out var n) ? n.GetString() ?? ticker : ticker;
            var currency = meta.TryGetProperty("currency", out var c) ? c.GetString() ?? "AUD" : "AUD";

            // Get previous close from the second-to-last data point (yesterday's close)
            decimal previousClose = 0m;
            if (result.TryGetProperty("indicators", out var indicators)
                && indicators.TryGetProperty("quote", out var quoteArr)
                && quoteArr.GetArrayLength() > 0)
            {
                var closes = quoteArr[0].GetProperty("close");
                var len = closes.GetArrayLength();
                // Walk backwards to find the second-to-last valid close
                int validCount = 0;
                for (int i = len - 1; i >= 0; i--)
                {
                    if (closes[i].ValueKind == JsonValueKind.Number)
                    {
                        validCount++;
                        if (validCount == 2)
                        {
                            previousClose = closes[i].GetDecimal();
                            break;
                        }
                    }
                }
            }
            // Fallback to meta previousClose if we couldn't extract from data
            if (previousClose == 0m)
            {
                previousClose = meta.TryGetProperty("previousClose", out var pc2) ? pc2.GetDecimal() : price;
            }

            var data = new QuoteData
            {
                Price = price,
                PreviousClose = previousClose,
                Name = name,
                Currency = currency,
                YtdDivPerShare = 0m, // Dividends require separate API call
            };

            _cache.Set(cacheKey, data, CacheTtl);
            return data;
        }
        catch
        {
            return new QuoteData { Price = 0, Name = ticker, Currency = "AUD", YtdDivPerShare = 0 };
        }
    }

    public async Task<List<HistoryPoint>> GetHistoryAsync(string ticker, string period = "6mo")
    {
        var client = _httpFactory.CreateClient("YahooFinance");
        try
        {
            var url = $"https://query1.finance.yahoo.com/v8/finance/chart/{Uri.EscapeDataString(ticker)}?interval=1d&range={period}";
            var response = await client.GetStringAsync(url);
            var doc = JsonDocument.Parse(response);
            var result = doc.RootElement.GetProperty("chart").GetProperty("result")[0];

            var timestamps = result.GetProperty("timestamp");
            var closes = result.GetProperty("indicators").GetProperty("quote")[0].GetProperty("close");

            var points = new List<HistoryPoint>();
            for (int i = 0; i < timestamps.GetArrayLength(); i++)
            {
                var ts = timestamps[i].GetInt64();
                var date = DateTimeOffset.FromUnixTimeSeconds(ts).DateTime;

                if (closes[i].ValueKind == JsonValueKind.Number)
                {
                    points.Add(new HistoryPoint
                    {
                        Date = date.ToString("yyyy-MM-dd"),
                        Close = Math.Round(closes[i].GetDecimal(), 2),
                    });
                }
            }
            return points;
        }
        catch
        {
            return [];
        }
    }

    public async Task<TickerDetailsData> GetTickerDetailsAsync(string ticker)
    {
        string cacheKey = $"yf_details_{ticker}";
        if (_cache.TryGetValue(cacheKey, out TickerDetailsData? cached))
            return cached!;

        var client = _httpFactory.CreateClient("YahooFinance");
        var result = new TickerDetailsData();

        // 1. Fetch 1Y chart for performance % calculations + 52-week from meta
        try
        {
            var chartUrl = $"https://query1.finance.yahoo.com/v8/finance/chart/{Uri.EscapeDataString(ticker)}?interval=1d&range=1y";
            var chartResponse = await client.GetStringAsync(chartUrl);
            var chartDoc = JsonDocument.Parse(chartResponse);
            var chartResult = chartDoc.RootElement.GetProperty("chart").GetProperty("result")[0];
            var meta = chartResult.GetProperty("meta");

            result.FiftyTwoWeekHigh = SafeGetDecimal(meta, "fiftyTwoWeekHigh");
            result.FiftyTwoWeekLow = SafeGetDecimal(meta, "fiftyTwoWeekLow");
            result.Currency = meta.TryGetProperty("currency", out var c) ? c.GetString() ?? "AUD" : "AUD";
            result.Exchange = meta.TryGetProperty("exchangeName", out var ex) ? ex.GetString() ?? "" : "";

            // Parse history
            var history = new List<(DateTime Date, decimal Close)>();
            if (chartResult.TryGetProperty("timestamp", out var timestamps)
                && chartResult.TryGetProperty("indicators", out var indicators)
                && indicators.TryGetProperty("quote", out var quoteArr)
                && quoteArr.GetArrayLength() > 0)
            {
                var closes = quoteArr[0].GetProperty("close");
                for (int i = 0; i < timestamps.GetArrayLength(); i++)
                {
                    if (closes[i].ValueKind == JsonValueKind.Number)
                    {
                        var ts = timestamps[i].GetInt64();
                        var date = DateTimeOffset.FromUnixTimeSeconds(ts).DateTime;
                        history.Add((date, closes[i].GetDecimal()));
                    }
                }
            }

            if (history.Count > 1)
            {
                var current = history[^1].Close;
                var today = DateTime.UtcNow.Date;

                var weekPrice = FindClosestPrice(history, today.AddDays(-7));
                result.WeekChangePct = CalcPctChange(current, weekPrice);

                var monthPrice = FindClosestPrice(history, today.AddMonths(-1));
                result.MonthChangePct = CalcPctChange(current, monthPrice);

                var ytdPrice = FindClosestPrice(history, new DateTime(today.Year, 1, 1));
                result.YtdChangePct = CalcPctChange(current, ytdPrice);

                result.YearChangePct = CalcPctChange(current, history[0].Close);
            }
        }
        catch { /* leave performance fields at 0 */ }

        // 2. Fetch quoteSummary for fundamentals (requires crumb auth)
        try
        {
            await EnsureCrumbAsync();
            var summaryUrl = $"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{Uri.EscapeDataString(ticker)}?modules=summaryDetail,defaultKeyStatistics&crumb={Uri.EscapeDataString(_crumb!)}";
            var request = new HttpRequestMessage(HttpMethod.Get, summaryUrl);
            request.Headers.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
            if (_cookieHeader != null)
                request.Headers.Add("Cookie", _cookieHeader);
            var httpClient = _httpFactory.CreateClient();
            var httpResponse = await httpClient.SendAsync(request);
            var summaryResponse = await httpResponse.Content.ReadAsStringAsync();
            var summaryDoc = JsonDocument.Parse(summaryResponse);
            var quoteSummary = summaryDoc.RootElement
                .GetProperty("quoteSummary").GetProperty("result")[0];

            if (quoteSummary.TryGetProperty("summaryDetail", out var sd))
            {
                var rawYield = SafeGetRaw(sd, "dividendYield");
                result.DividendYield = rawYield.HasValue ? Math.Round(rawYield.Value * 100, 2) : null;
                result.TrailingPE = SafeGetRaw(sd, "trailingPE");
                result.MarketCap = SafeGetRaw(sd, "marketCap");
            }
            if (quoteSummary.TryGetProperty("defaultKeyStatistics", out var dks))
            {
                result.Beta ??= SafeGetRaw(dks, "beta");
            }
        }
        catch { /* leave fundamental fields null */ }

        _cache.Set(cacheKey, result, CacheTtl);
        return result;
    }

    private static decimal? SafeGetDecimal(JsonElement parent, string prop)
    {
        if (!parent.TryGetProperty(prop, out var el)) return null;
        return el.ValueKind == JsonValueKind.Number ? el.GetDecimal() : null;
    }

    private static decimal? SafeGetRaw(JsonElement parent, string prop)
    {
        if (!parent.TryGetProperty(prop, out var el)) return null;
        if (el.ValueKind == JsonValueKind.Object && el.TryGetProperty("raw", out var raw))
            return raw.ValueKind == JsonValueKind.Number ? raw.GetDecimal() : null;
        return el.ValueKind == JsonValueKind.Number ? el.GetDecimal() : null;
    }

    private static decimal FindClosestPrice(List<(DateTime Date, decimal Close)> history, DateTime target)
    {
        // Find the first data point on or after the target date
        for (int i = 0; i < history.Count; i++)
        {
            if (history[i].Date.Date >= target.Date)
                return history[i].Close;
        }
        return history[0].Close;
    }

    private static decimal CalcPctChange(decimal current, decimal basis)
    {
        if (basis == 0) return 0;
        return Math.Round(((current - basis) / basis) * 100, 2);
    }

    public async Task<List<TickerSearchResult>> SearchAsync(string query, int maxResults = 10)
    {
        var client = _httpFactory.CreateClient("YahooFinance");
        try
        {
            var url = $"https://query1.finance.yahoo.com/v1/finance/search?q={Uri.EscapeDataString(query)}&quotesCount={maxResults}&newsCount=0";
            var response = await client.GetStringAsync(url);
            var doc = JsonDocument.Parse(response);

            var results = new List<TickerSearchResult>();
            if (doc.RootElement.TryGetProperty("quotes", out var quotes))
            {
                foreach (var qt in quotes.EnumerateArray())
                {
                    var symbol = qt.TryGetProperty("symbol", out var s) ? s.GetString() ?? "" : "";
                    var exchange = qt.TryGetProperty("exchange", out var e) ? e.GetString() ?? "" : "";
                    var name = qt.TryGetProperty("longname", out var ln) ? ln.GetString() ?? "" : "";
                    if (string.IsNullOrEmpty(name))
                        name = qt.TryGetProperty("shortname", out var sn) ? sn.GetString() ?? "" : "";

                    results.Add(new TickerSearchResult
                    {
                        Ticker = symbol,
                        Name = name,
                        Exchange = exchange,
                    });
                }
            }
            return results;
        }
        catch
        {
            return [];
        }
    }
}

public class QuoteData
{
    public decimal Price { get; set; }
    public decimal PreviousClose { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Currency { get; set; } = "AUD";
    public decimal YtdDivPerShare { get; set; }
}

public class HistoryPoint
{
    public string Date { get; set; } = string.Empty;
    public decimal Close { get; set; }
}

public class TickerSearchResult
{
    public string Ticker { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Exchange { get; set; } = string.Empty;
}

public class TickerDetailsData
{
    public decimal WeekChangePct { get; set; }
    public decimal MonthChangePct { get; set; }
    public decimal YtdChangePct { get; set; }
    public decimal YearChangePct { get; set; }
    public decimal? DividendYield { get; set; }
    public decimal? TrailingPE { get; set; }
    public decimal? MarketCap { get; set; }
    public decimal? FiftyTwoWeekHigh { get; set; }
    public decimal? FiftyTwoWeekLow { get; set; }
    public decimal? Beta { get; set; }
    public string Currency { get; set; } = "AUD";
    public string Exchange { get; set; } = string.Empty;
}
