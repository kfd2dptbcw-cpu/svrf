import SwiftUI
import WidgetKit

// MARK: - Timeline

struct ForecastEntry: TimelineEntry {
    let date: Date
    let spotName: String
    let today: DaySummary?
    let tomorrow: DaySummary?
    let unavailable: Bool

    static let placeholder = ForecastEntry(
        date: Date(),
        spotName: defaultSpotName,
        today: DaySummary(date: "", rating: 3, label: "Good", surfMinFt: 2, surfMaxFt: 4,
                          windType: "offshore", windSpeedKmh: 12, swellPeriodS: 11, headline: nil),
        tomorrow: DaySummary(date: "", rating: 2, label: "Fair", surfMinFt: 1, surfMaxFt: 3,
                             windType: "onshore", windSpeedKmh: 20, swellPeriodS: 8, headline: nil),
        unavailable: false
    )
}

struct Provider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> ForecastEntry { .placeholder }

    func snapshot(for configuration: SelectSpotIntent, in context: Context) async -> ForecastEntry {
        context.isPreview ? .placeholder : await load(configuration)
    }

    func timeline(for configuration: SelectSpotIntent, in context: Context) async -> Timeline<ForecastEntry> {
        let entry = await load(configuration)
        // The forecast refreshes about daily; checking every 3 hours is plenty.
        let next = Calendar.current.date(byAdding: .hour, value: 3, to: Date()) ?? Date().addingTimeInterval(10_800)
        return Timeline(entries: [entry], policy: .after(next))
    }

    private func load(_ configuration: SelectSpotIntent) async -> ForecastEntry {
        let slug = configuration.spot?.id ?? defaultSpotSlug
        let now = Date()
        do {
            let response = try await ForecastAPI.fetch()
            guard let spot = response.spots.first(where: { $0.slug == slug }) else {
                return ForecastEntry(date: now, spotName: configuration.spot?.name ?? defaultSpotName,
                                     today: nil, tomorrow: nil, unavailable: true)
            }
            return ForecastEntry(
                date: now,
                spotName: spot.name,
                today: spot.days[UKDate.key(for: now)],
                tomorrow: spot.days[UKDate.tomorrowKey(from: now)],
                unavailable: false
            )
        } catch {
            return ForecastEntry(date: now, spotName: configuration.spot?.name ?? defaultSpotName,
                                 today: nil, tomorrow: nil, unavailable: true)
        }
    }
}

// MARK: - Views

private func ratingColor(_ rating: Int) -> Color {
    switch rating {
    case 5: return Color(red: 0.20, green: 0.85, blue: 0.55)
    case 4: return Color(red: 0.40, green: 0.80, blue: 0.40)
    case 3: return Color(red: 0.95, green: 0.80, blue: 0.25)
    case 2: return Color(red: 0.95, green: 0.55, blue: 0.25)
    default: return Color(red: 0.90, green: 0.35, blue: 0.35)
    }
}

private struct Stars: View {
    let rating: Int
    var body: some View {
        HStack(spacing: 2) {
            ForEach(1...5, id: \.self) { index in
                Image(systemName: index <= rating ? "star.fill" : "star")
                    .font(.system(size: 9))
            }
        }
        .foregroundStyle(ratingColor(rating))
    }
}

private struct DayBlock: View {
    let title: String
    let day: DaySummary?

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title.uppercased())
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
            if let day {
                Text(day.waveText)
                    .font(.system(size: 26, weight: .heavy, design: .rounded))
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Stars(rating: day.rating)
                    Text(day.label)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(ratingColor(day.rating))
                }
                Text(day.windText)
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            } else {
                Text("No data")
                    .font(.system(size: 13))
                    .foregroundStyle(.secondary)
            }
        }
    }
}

struct SVRFWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: ForecastEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.spotName)
                .font(.system(size: 13, weight: .bold))
                .lineLimit(1)

            if entry.unavailable {
                Text("Forecast unavailable. Open the app to retry.")
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            } else if family == .systemMedium {
                HStack(alignment: .top, spacing: 16) {
                    DayBlock(title: "Today", day: entry.today)
                    Divider()
                    DayBlock(title: "Tomorrow", day: entry.tomorrow)
                }
            } else {
                DayBlock(title: "Today", day: entry.today)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .foregroundStyle(Color(red: 0.95, green: 0.96, blue: 0.96))
        .containerBackground(Color(red: 0.043, green: 0.051, blue: 0.055), for: .widget)
    }
}

// MARK: - Widget

struct SVRFWidget: Widget {
    let kind = "SVRFWidget"

    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: kind, intent: SelectSpotIntent.self, provider: Provider()) { entry in
            SVRFWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("SVRF Surf Forecast")
        .description("Wave height, rating and wind for your spot.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct SVRFWidgetBundle: WidgetBundle {
    var body: some Widget {
        SVRFWidget()
    }
}
