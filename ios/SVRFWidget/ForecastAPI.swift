import Foundation

// Mirrors the compact JSON served by https://forecast.svrf.uk/api/forecast
// (see src/lib/forecast/selectors.ts: CompactDay / SpotListItem).

struct ForecastResponse: Decodable {
    let status: String?
    let generatedAt: String?
    let spots: [SpotSummary]
}

struct SpotSummary: Decodable, Identifiable {
    let slug: String
    let name: String
    let regionName: String
    let days: [String: DaySummary]
    var id: String { slug }
}

struct DaySummary: Decodable {
    let date: String
    let rating: Int
    let label: String
    let surfMinFt: Double
    let surfMaxFt: Double
    let windType: String?
    let windSpeedKmh: Double?
    let swellPeriodS: Double?
    let headline: String?

    var waveText: String {
        let lo = Int(surfMinFt.rounded())
        let hi = Int(surfMaxFt.rounded())
        return lo == hi ? "\(hi)ft" : "\(lo)-\(hi)ft"
    }

    var windText: String {
        guard let kmh = windSpeedKmh else { return "Wind n/a" }
        let mph = Int((kmh * 0.621371).rounded())
        let kind = windType.map { $0.capitalized } ?? "Wind"
        return "\(kind) \(mph)mph"
    }
}

enum ForecastAPI {
    static let url = URL(string: "https://forecast.svrf.uk/api/forecast")!

    static func fetch() async throws -> ForecastResponse {
        var request = URLRequest(url: url)
        request.timeoutInterval = 15
        let (data, response) = try await URLSession.shared.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(ForecastResponse.self, from: data)
    }
}

/// UK calendar date keys (YYYY-MM-DD), matching the site's day keys.
enum UKDate {
    private static let formatter: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_GB_POSIX")
        f.timeZone = TimeZone(identifier: "Europe/London")
        f.dateFormat = "yyyy-MM-dd"
        return f
    }()

    static func key(for date: Date) -> String { formatter.string(from: date) }

    static func tomorrowKey(from date: Date) -> String {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/London")!
        let next = calendar.date(byAdding: .day, value: 1, to: date) ?? date
        return key(for: next)
    }
}
