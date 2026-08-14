import SwiftUI
import WidgetKit

// ===================== ContentView.swift =====================
// Nahraď TÝMTO obsahom pôvodný, Xcode-om vygenerovaný ContentView.swift
// v hlavnom appka-targete (nie vo widget targete). Pozri SETUP.md, krok 5.
// ================================================================

struct ContentView: View {
    @State private var email: String = SharedStore.userEmail ?? ""
    @State private var password: String = ""
    @State private var isLoading = false
    @State private var errorText: String?
    @State private var isSignedIn: Bool = SharedStore.refreshToken != nil

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "video.badge.checkmark")
                .font(.system(size: 40))
                .foregroundStyle(.orange)

            Text("SLATE widget")
                .font(.title2).bold()

            if isSignedIn {
                VStack(spacing: 10) {
                    Text("Prihlásený ako")
                        .foregroundStyle(.secondary)
                    Text(SharedStore.userEmail ?? "")
                        .bold()
                    Text("Widget na ploche/Notification Center teraz zobrazuje najbližšiu zákazku. Ak sa dáta nezobrazia hneď, chvíľu počkaj — macOS widgety sa neobnovujú okamžite.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    Button("Odhlásiť sa") {
                        SharedStore.signOut()
                        isSignedIn = false
                        password = ""
                        WidgetCenter.shared.reloadAllTimelines()
                    }
                    .buttonStyle(.bordered)
                    .padding(.top, 6)
                }
            } else {
                VStack(spacing: 10) {
                    TextField("E-mail", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.username)
                    SecureField("Heslo", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.password)
                        .onSubmit { signIn() }

                    if let errorText {
                        Text(errorText)
                            .font(.footnote)
                            .foregroundStyle(.red)
                    }

                    Button(isLoading ? "Prihlasujem…" : "Prihlásiť sa") {
                        signIn()
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                }
                .frame(maxWidth: 280)
            }
        }
        .padding(30)
        .frame(width: 360, height: isSignedIn ? 260 : 300)
    }

    private func signIn() {
        errorText = nil
        isLoading = true
        Task {
            do {
                let tokens = try await SupabaseAPI.signIn(email: email, password: password)
                SharedStore.refreshToken = tokens.refresh_token
                SharedStore.userEmail = email
                isSignedIn = true
                WidgetCenter.shared.reloadAllTimelines()
            } catch {
                errorText = error.localizedDescription
            }
            isLoading = false
        }
    }
}

#Preview {
    ContentView()
}
