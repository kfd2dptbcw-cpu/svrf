import AppIntents
import WidgetKit

/// Default spot when none has been chosen. Matches a slug in config/spots.json.
let defaultSpotSlug = "fistral"
let defaultSpotName = "Fistral Beach"

struct SpotEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Surf spot"
    static var defaultQuery = SpotQuery()

    var id: String
    var name: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

struct SpotQuery: EntityQuery {
    private func allSpots() async -> [SpotEntity] {
        if let response = try? await ForecastAPI.fetch() {
            return response.spots
                .map { SpotEntity(id: $0.slug, name: $0.name) }
                .sorted { $0.name < $1.name }
        }
        return [SpotEntity(id: defaultSpotSlug, name: defaultSpotName)]
    }

    func entities(for identifiers: [String]) async throws -> [SpotEntity] {
        await allSpots().filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [SpotEntity] {
        await allSpots()
    }

    func defaultResult() async -> SpotEntity? {
        SpotEntity(id: defaultSpotSlug, name: defaultSpotName)
    }
}

struct SelectSpotIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Surf spot"
    static var description = IntentDescription("Choose which surf spot the widget shows.")

    @Parameter(title: "Spot")
    var spot: SpotEntity?
}
