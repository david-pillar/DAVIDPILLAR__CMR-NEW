import WidgetKit
import SwiftUI

// ===================== NextProjectWidget.swift =====================
// Nahraď TÝMTO celý obsah Xcode-om vygenerovaného súboru vo widget extension
// targete (ten, čo obsahuje "@main struct ... : WidgetBundle"). Pozri SETUP.md, krok 6.
// Vyžaduje macOS 14 Sonoma alebo novší.
// ================================================================

struct NextProjectEntry: TimelineEntry {
    let date: Date
    let title: String
    let clientName: String?
    let deadline: Date?
    let statusText: String
}

struct NextProjectProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextProjectEntry {
        NextProjectEntry(date: Date(), title: "Svadba Novákovci", clientName: "Nováková", deadline: Date().addingTimeInterval(86400*10), statusText: "")
    }

    func getSnapshot(in context: Context, completion: @escaping (NextProjectEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextProjectEntry>) -> Void) {
        Task {
            let entry = await loadEntry()
            // Widget si dáta sám obnoví o hodinu; hlavná appka navyše po prihlásení/odhlásení
            // zavolá WidgetCenter.shared.reloadAllTimelines(), takže sa obnoví aj skôr.
            let nextRefresh = Date().addingTimeInterval(60 * 60)
            completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
        }
    }

    private func loadEntry() async -> NextProjectEntry {
        guard let refreshToken = SharedStore.refreshToken else {
            return NextProjectEntry(date: Date(), title: "Nie si prihlásený", clientName: nil, deadline: nil, statusText: "Otvor appku „SLATE widget“ a prihlás sa")
        }
        do {
            let tokens = try await SupabaseAPI.refreshAccessToken(refreshToken: refreshToken)
            SharedStore.refreshToken = tokens.refresh_token
            guard let result = try await SupabaseAPI.fetchNextProject(accessToken: tokens.access_token) else {
                return NextProjectEntry(date: Date(), title: "Žiadna nadchádzajúca zákazka", clientName: nil, deadline: nil, statusText: "")
            }
            let df = DateFormatter()
            df.dateFormat = "yyyy-MM-dd"
            df.timeZone = TimeZone(identifier: "Europe/Bratislava")
            let deadlineDate = result.project.deadline.flatMap { df.date(from: $0) }
            return NextProjectEntry(
                date: Date(),
                title: result.project.title?.isEmpty == false ? result.project.title! : "Zákazka",
                clientName: result.clientName,
                deadline: deadlineDate,
                statusText: STATUS_LABELS_SK[result.project.status ?? ""] ?? ""
            )
        } catch {
            return NextProjectEntry(date: Date(), title: "Chyba pri načítaní", clientName: nil, deadline: nil, statusText: error.localizedDescription)
        }
    }
}

private let STATUS_LABELS_SK: [String: String] = [
    "dopyt": "Dopyt", "zabookovane": "Zabookované", "nakrutene": "Nakrútené",
    "spracovane": "Spracované", "zaplatene": "Zaplatené"
]

struct NextProjectWidgetView: View {
    var entry: NextProjectEntry

    private var daysUntilText: String {
        guard let deadline = entry.deadline else { return "" }
        let days = Calendar.current.dateComponents([.day], from: Calendar.current.startOfDay(for: Date()), to: deadline).day ?? 0
        if days == 0 { return "Dnes 🎬" }
        if days == 1 { return "Zajtra" }
        return "o \(days) dní"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "video.badge.checkmark")
                    .foregroundStyle(.orange)
                Text("SLATE")
                    .font(.caption).bold()
                    .foregroundStyle(.secondary)
                Spacer()
            }
            Spacer(minLength: 0)
            Text(entry.title)
                .font(.headline)
                .lineLimit(2)
            if let clientName = entry.clientName, !clientName.isEmpty {
                Text(clientName)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
            if entry.deadline != nil {
                Text(daysUntilText)
                    .font(.caption).bold()
                    .foregroundStyle(.orange)
            } else if !entry.statusText.isEmpty {
                Text(entry.statusText)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        }
        .padding()
        .containerBackground(.background, for: .widget)
    }
}

struct NextProjectWidget: Widget {
    let kind: String = "NextProjectWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextProjectProvider()) { entry in
            NextProjectWidgetView(entry: entry)
        }
        .configurationDisplayName("Najbližšia zákazka")
        .description("Ukáže najbližšiu nadchádzajúcu svadbu/zákazku zo SLATE.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct SlateWidgetBundle: WidgetBundle {
    var body: some Widget {
        NextProjectWidget()
    }
}
