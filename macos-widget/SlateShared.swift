import Foundation

// ===================== SlateShared.swift =====================
// Zdieľané medzi hlavnou appkou (login) a widget extension-om.
// Pri pridávaní tohto súboru do Xcode zaškrtni OBIDVA targety (Target Membership).
// ================================================================

// MARK: - Supabase konfigurácia (rovnaký projekt ako webová appka SLATE)
enum SupabaseConfig {
    static let url = "https://opxrzhduiijnrpevczpv.supabase.co"
    static let anonKey = "sb_publishable_euM-aG0JRWb4PscQIv5PAA_btJYyQTY"
    // MUSÍ byť presne zhodné s App Group ID, ktoré nastavíš v Signing & Capabilities
    // na OBOCH targetoch (pozri SETUP.md, krok 4).
    static let appGroupId = "group.com.davidpillar.slate"
}

// MARK: - Zdieľané úložisko (hlavná appka sem po prihlásení zapíše token, widget si ho odtiaľ prečíta)
enum SharedStore {
    static var defaults: UserDefaults {
        UserDefaults(suiteName: SupabaseConfig.appGroupId) ?? .standard
    }
    static var refreshToken: String? {
        get { defaults.string(forKey: "slate.refreshToken") }
        set { defaults.set(newValue, forKey: "slate.refreshToken") }
    }
    static var userEmail: String? {
        get { defaults.string(forKey: "slate.userEmail") }
        set { defaults.set(newValue, forKey: "slate.userEmail") }
    }
    static func signOut() {
        defaults.removeObject(forKey: "slate.refreshToken")
        defaults.removeObject(forKey: "slate.userEmail")
    }
}

// MARK: - Dátové modely (zodpovedajú tvaru, aký appka ukladá do Supabase — pozri js/16-project-crud.js)
struct SlateProject: Codable {
    var id: String?
    var title: String?
    var clientId: String?
    var deadline: String?   // "YYYY-MM-DD"
    var status: String?
    var type: String?       // "svadba" | "stuzkova" | "klip" ...
    var location: String?
}
struct SlateClient: Codable {
    var id: String?
    var name: String?
}
private struct DataRow<T: Codable>: Codable { let data: T }

// MARK: - Supabase Auth + REST, čisto cez URLSession (bez SDK závislosti vo widgete)
enum SupabaseAPI {

    struct AuthTokens: Codable {
        let access_token: String
        let refresh_token: String
    }

    static func signIn(email: String, password: String) async throws -> AuthTokens {
        var req = URLRequest(url: URL(string: "\(SupabaseConfig.url)/auth/v1/token?grant_type=password")!)
        req.httpMethod = "POST"
        req.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["email": email, "password": password])
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else {
            throw NSError(domain: "SlateAuth", code: 1, userInfo: [NSLocalizedDescriptionKey: "Nesprávny e-mail alebo heslo."])
        }
        return try JSONDecoder().decode(AuthTokens.self, from: data)
    }

    static func refreshAccessToken(refreshToken: String) async throws -> AuthTokens {
        var req = URLRequest(url: URL(string: "\(SupabaseConfig.url)/auth/v1/token?grant_type=refresh_token")!)
        req.httpMethod = "POST"
        req.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": refreshToken])
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else {
            throw NSError(domain: "SlateAuth", code: 2, userInfo: [NSLocalizedDescriptionKey: "Prihlásenie vypršalo, prihlás sa znova v appke."])
        }
        return try JSONDecoder().decode(AuthTokens.self, from: data)
    }

    private static func fetchRows<T: Codable>(table: String, accessToken: String) async throws -> [T] {
        var req = URLRequest(url: URL(string: "\(SupabaseConfig.url)/rest/v1/\(table)?select=data")!)
        req.setValue(SupabaseConfig.anonKey, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        let (data, resp) = try await URLSession.shared.data(for: req)
        guard (resp as? HTTPURLResponse)?.statusCode == 200 else {
            throw NSError(domain: "SlateAPI", code: 3, userInfo: [NSLocalizedDescriptionKey: "Nepodarilo sa načítať dáta (\(table))."])
        }
        let rows = try JSONDecoder().decode([DataRow<T>].self, from: data)
        return rows.map { $0.data }
    }

    /// Nájde najbližšiu nadchádzajúcu zákazku (podľa deadline, vrátane dneška) a k nej meno klienta.
    static func fetchNextProject(accessToken: String) async throws -> (project: SlateProject, clientName: String?)? {
        async let projectsTask: [SlateProject] = fetchRows(table: "projects", accessToken: accessToken)
        async let clientsTask: [SlateClient] = fetchRows(table: "clients", accessToken: accessToken)
        let (allProjects, allClients) = try await (projectsTask, clientsTask)

        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd"
        df.timeZone = TimeZone(identifier: "Europe/Bratislava")
        let today = Calendar.current.startOfDay(for: Date())

        let upcoming = allProjects
            .compactMap { p -> (SlateProject, Date)? in
                guard let d = p.deadline, let date = df.date(from: d) else { return nil }
                return (p, date)
            }
            .filter { $0.1 >= today }
            .sorted { $0.1 < $1.1 }

        guard let next = upcoming.first else { return nil }
        let clientName = allClients.first(where: { $0.id == next.0.clientId })?.name
        return (next.0, clientName)
    }
}
