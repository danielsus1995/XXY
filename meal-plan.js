import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function vypocitejTDEE(vaha, vyska, vek, pohlavi) {
  const bmr =
    pohlavi === "muz"
      ? 10 * vaha + 6.25 * vyska - 5 * vek + 5
      : 10 * vaha + 6.25 * vyska - 5 * vek - 161;
  return Math.round(bmr * 1.55);
}

function ciloveKalorii(tdee, goal) {
  return goal.includes("svalovou") ? tdee + 300 : tdee - 400;
}

function vypocitejMakra(kalorii, vaha, goal) {
  const isSvaly = goal.includes("svalovou");
  const bilkoviny = Math.round(vaha * (isSvaly ? 2.0 : 2.2));
  const tuky      = Math.round((kalorii * 0.28) / 9);
  const zbylekKcal = kalorii - bilkoviny * 4 - tuky * 9;
  const sacharidy = Math.round(zbylekKcal / 4);
  return { kalorii, bilkoviny, sacharidy, tuky };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { clenove, budget, diet } = req.body;

  if (!clenove || !Array.isArray(clenove) || clenove.length === 0 || !budget) {
    return res.status(400).json({ error: "Chybí povinné parametry" });
  }

  // calculate TDEE and macros for each member
  const clenoveData = clenove.map(cl => {
    const tdee = vypocitejTDEE(cl.vaha, cl.vyska, cl.vek, cl.pohlavi);
    const kcal = ciloveKalorii(tdee, cl.goal);
    const makra = vypocitejMakra(kcal, cl.vaha, cl.goal);
    return { ...cl, tdee, ciloveKalorii: kcal, makra };
  });

  const profileLines = clenoveData.map(cl => {
    const isSvaly = cl.goal.includes("svalovou");
    const diff = Math.abs(cl.ciloveKalorii - cl.tdee);
    const smer = isSvaly ? `přebytek +${diff} kcal` : `deficit −${diff} kcal`;
    return `- ${cl.jmeno} (${cl.pohlavi === "muz" ? "muž" : "žena"}, ${cl.vek} let, ${cl.vaha} kg, ${cl.vyska} cm): cíl = ${cl.goal}, TDEE = ${cl.tdee} kcal → cílové = ${cl.ciloveKalorii} kcal (${smer}), makra: ${cl.makra.bilkoviny}g B / ${cl.makra.sacharidy}g S / ${cl.makra.tuky}g T`;
  }).join("\n");

  const namesJoined = clenoveData.map(c => c.jmeno).join(", ");
  const people = clenoveData.length;

  const systemPrompt = `Jsi certifikovaný nutriční terapeut a expert na rodinnou výživu.
Odpovídáš VŽDY v češtině.
Tvoříš personalizované rodinné jídelníčky pro českou kuchyni s dostupnými ingrediencemi z Lidlu, Alberta a Tesca.
Ceny jsou v Kč, realistické pro rok 2025.
Každý den se vaří JEDNO společné jídlo — každý člen dostane upozornění co přidat nebo vynechat.
Jsi přímý, motivující a praktický — žádné zbytečné fráze.`;

  const userPrompt = `Vytvoř 7-denní RODINNÝ jídelníček pro ${people} ${people === 1 ? "osobu" : people < 5 ? "osoby" : "osob"}: ${namesJoined}.

PROFILY ČLENŮ:
${profileLines}

SPOLEČNÉ:
- Stravovací omezení: ${diet || "žádné"}
- Celkový týdenní rozpočet: ${budget} Kč pro ${people} ${people === 1 ? "osobu" : people < 5 ? "osoby" : "osob"}

PRAVIDLA:
- Každé jídlo (snídaně, oběd, večeře) je JEDNO společné jídlo, které celá rodina vaří dohromady.
- Pro každého člena uveď v poli "upravy" co konkrétně přidá nebo vynechá (porce, přísady), aby splnil svůj kalorický cíl.
- Jídla musí být připravitelná do 30 minut.
- Ceny musí odpovídat zadanému rozpočtu.
- V doporuceni pro každého člena uveď 2-3 věty přizpůsobené jeho cíli a parametrům.

Odpověz VÝHRADNĚ v JSON (žádný jiný text):
{
  "nazevPlanu": "krátký, motivující název plánu pro celou rodinu",
  "popisPlanu": "1-2 věty popis rodinného plánu",
  "clenove": [
    {
      "jmeno": "${clenoveData[0].jmeno}",
      "goal": "${clenoveData[0].goal}",
      "tdee": ${clenoveData[0].tdee},
      "ciloveKalorii": ${clenoveData[0].ciloveKalorii},
      "makra": { "kalorii": ${clenoveData[0].makra.kalorii}, "bilkoviny": ${clenoveData[0].makra.bilkoviny}, "sacharidy": ${clenoveData[0].makra.sacharidy}, "tuky": ${clenoveData[0].makra.tuky} },
      "doporuceni": "osobní doporučení pro tohoto člena"
    }
  ],
  "jidelnicek": [
    {
      "den": "Pondělí",
      "snidane": {
        "nazev": "...",
        "ingredience": ["...", "..."],
        "cena": 0,
        "upravy": { "${clenoveData[0].jmeno}": "co přidá nebo vynechá" }
      },
      "obed": {
        "nazev": "...",
        "ingredience": ["...", "..."],
        "cena": 0,
        "upravy": { "${clenoveData[0].jmeno}": "co přidá nebo vynechá" }
      },
      "vecere": {
        "nazev": "...",
        "ingredience": ["...", "..."],
        "cena": 0,
        "upravy": { "${clenoveData[0].jmeno}": "co přidá nebo vynechá" }
      }
    }
  ],
  "nakupniSeznam": [
    { "polozka": "...", "mnozstvi": "...", "odhadovanaCena": 0 }
  ],
  "celkovaCena": 0,
  "tipyNaUsporu": ["...", "...", "..."],
  "vyzivoveTipy": ["...", "...", "..."]
}

DŮLEŽITÉ: Pole "clenove" musí obsahovat VŠECHNY ${people} členy (${namesJoined}). Pole "upravy" v každém jídle musí obsahovat klíč pro každého člena.`;

  try {
    const stream = await client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 12000,
      thinking: { type: "adaptive" },
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const response = await stream.finalMessage();

    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock) {
      return res.status(500).json({ error: "Nepodařilo se vygenerovat jídelníček" });
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: "Nepodařilo se zpracovat odpověď AI" });
    }

    const data = JSON.parse(jsonMatch[0]);
    return res.status(200).json(data);
  } catch (error) {
    console.error("Claude API error:", error);
    return res.status(500).json({ error: "Chyba při generování jídelníčku: " + error.message });
  }
}
