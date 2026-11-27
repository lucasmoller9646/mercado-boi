// Complicação do Apple Watch (WidgetKit, watchOS 10+). Diferente dos widgets do iPhone feitos com expo-widgets,
// esta busca as cotações sozinha: o arquivo público do robô do mercado-boi, atualizado a cada 20 minutos.
import SwiftUI
import WidgetKit

struct Cotacao: Decodable {
  let id: String
  let rot: String
  let val: Double?
  let val2: Double?
  let dec: Int
  let `var`: Double?
}

struct Arquivo: Decodable {
  let atualizado: String
  let itens: [Cotacao]
}

struct Entrada: TimelineEntry {
  let date: Date
  let itens: [Cotacao]
}

private let urlCotacoes = URL(string: "https://raw.githubusercontent.com/lucasmoller9646/mercado-boi/dados/cotacoes.json")!

private func formatar(_ v: Double?, _ dec: Int) -> String {
  guard let v else { return "–" }
  let f = NumberFormatter()
  f.locale = Locale(identifier: "pt_BR")
  f.numberStyle = .decimal
  f.minimumFractionDigits = dec
  f.maximumFractionDigits = dec
  return f.string(from: NSNumber(value: v)) ?? "–"
}

private func variacao(_ v: Double?) -> String {
  guard let v else { return "" }
  let seta = v > 0 ? "▲" : (v < 0 ? "▼" : "•")
  return seta + String(format: "%.1f%%", abs(v) * 100).replacingOccurrences(of: ".", with: ",")
}

struct Provedor: TimelineProvider {
  func placeholder(in context: Context) -> Entrada {
    Entrada(date: .now, itens: [Cotacao(id: "pyg", rot: "Gs/US$", val: 6400, val2: 6450, dec: 0, var: 0.001),
                                Cotacao(id: "boi", rot: "Boi PY", val: 5.0, val2: nil, dec: 2, var: 0)])
  }

  func getSnapshot(in context: Context, completion: @escaping (Entrada) -> Void) {
    completion(placeholder(in: context))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<Entrada>) -> Void) {
    Task {
      var itens: [Cotacao] = []
      if let (dados, _) = try? await URLSession.shared.data(from: urlCotacoes),
         let arq = try? JSONDecoder().decode(Arquivo.self, from: dados) {
        itens = arq.itens
      }
      // pede nova busca em 20 minutos (o watchOS decide quando, dentro do orçamento de atualizações)
      let proxima = Calendar.current.date(byAdding: .minute, value: 20, to: .now) ?? .now.addingTimeInterval(1200)
      completion(Timeline(entries: [Entrada(date: .now, itens: itens)], policy: .after(proxima)))
    }
  }
}

struct VistaRelogio: View {
  @Environment(\.widgetFamily) var familia
  let entrada: Entrada

  var cambio: Cotacao? { entrada.itens.first { $0.id == "pyg" } }
  var boi: Cotacao? { entrada.itens.first { $0.id == "boi" } }

  var body: some View {
    switch familia {
    case .accessoryInline:
      Text("Gs/US$ \(formatar(cambio?.val, 0)) · Boi \(formatar(boi?.val, 2))")
    case .accessoryCircular:
      VStack(spacing: 0) {
        Text("Gs/US$").font(.system(size: 9))
        Text(formatar(cambio?.val, 0)).font(.system(size: 13, weight: .bold)).minimumScaleFactor(0.6)
      }
    case .accessoryCorner:
      Text(formatar(cambio?.val, 0)).font(.system(size: 14, weight: .semibold))
        .widgetLabel { Text("Boi \(formatar(boi?.val, 2))") }
    default: // accessoryRectangular
      VStack(alignment: .leading, spacing: 1) {
        ForEach(Array(entrada.itens.prefix(3)), id: \.id) { c in
          HStack {
            Text(c.rot).font(.system(size: 12))
            Spacer()
            Text(formatar(c.val, c.dec)).font(.system(size: 12, weight: .semibold))
            Text(variacao(c.var)).font(.system(size: 10)).foregroundStyle((c.var ?? 0) >= 0 ? .green : .red)
          }
        }
      }
    }
  }
}

@main
struct MercadoBoiRelogio: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MercadoBoiRelogio", provider: Provedor()) { e in
      VistaRelogio(entrada: e).containerBackground(.black, for: .widget)
    }
    .configurationDisplayName("Mercado do Boi")
    .description("Câmbio do BCP, boi gordo e reposição")
    .supportedFamilies([.accessoryRectangular, .accessoryCircular, .accessoryInline, .accessoryCorner])
  }
}
