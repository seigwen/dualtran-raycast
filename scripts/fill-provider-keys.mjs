#!/usr/bin/env node
/**
 * One-off: add the three SPEC 2.1 provider keys to every machine-managed
 * locale. `scripts/locale-kit.mjs --fill-missing` is the repo's mechanism, but
 * its translation model endpoint (127.0.0.1:11434 / ollama.com) is unreachable
 * in this environment (no egress; ollama.com resolves to 127.0.0.1), so the
 * strings below are written directly. Existing keys are never touched.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

// [placeholder, requiredForModel, requiredError]
const T = {
  af: [
    "Kies 'n verskaffer",
    "Kies eers 'n verskaffer",
    "Kies eers 'n KI-verskaffer in die instellings voordat jy vertaal.",
  ],
  ar: ["اختر مزوّدًا", "اختر مزوّدًا أولًا", "اختر مزوّد ذكاء اصطناعي في الإعدادات قبل الترجمة."],
  ca: [
    "Selecciona un proveïdor",
    "Selecciona primer un proveïdor",
    "Tria un proveïdor d'IA als ajustos abans de traduir.",
  ],
  cs: [
    "Vyberte poskytovatele",
    "Nejprve vyberte poskytovatele",
    "Před překladem vyberte v nastavení poskytovatele AI.",
  ],
  da: ["Vælg en udbyder", "Vælg først en udbyder", "Vælg en AI-udbyder i indstillingerne, før du oversætter."],
  de: [
    "Anbieter auswählen",
    "Zuerst einen Anbieter auswählen",
    "Wähle vor dem Übersetzen einen KI-Anbieter in den Einstellungen.",
  ],
  el: ["Επιλέξτε πάροχο", "Επιλέξτε πρώτα πάροχο", "Επιλέξτε πάροχο AI στις ρυθμίσεις πριν από τη μετάφραση."],
  es: [
    "Selecciona un proveedor",
    "Selecciona primero un proveedor",
    "Elige un proveedor de IA en los ajustes antes de traducir.",
  ],
  fa: [
    "یک ارائه‌دهنده انتخاب کنید",
    "ابتدا یک ارائه‌دهنده انتخاب کنید",
    "پیش از ترجمه، یک ارائه‌دهنده هوش مصنوعی در تنظیمات انتخاب کنید.",
  ],
  fi: [
    "Valitse palveluntarjoaja",
    "Valitse ensin palveluntarjoaja",
    "Valitse AI-palveluntarjoaja asetuksista ennen kääntämistä.",
  ],
  fr: [
    "Choisir un fournisseur",
    "Choisissez d'abord un fournisseur",
    "Choisissez un fournisseur d'IA dans les préférences avant de traduire.",
  ],
  he: ["בחר ספק", "בחר תחילה ספק", "בחר ספק AI בהגדרות לפני התרגום."],
  hi: ["एक प्रदाता चुनें", "पहले एक प्रदाता चुनें", "अनुवाद करने से पहले सेटिंग्स में AI प्रदाता चुनें।"],
  hr: [
    "Odaberite pružatelja",
    "Najprije odaberite pružatelja",
    "Prije prevođenja odaberite AI pružatelja u postavkama.",
  ],
  hu: [
    "Válasszon szolgáltatót",
    "Először válasszon szolgáltatót",
    "Fordítás előtt válasszon AI-szolgáltatót a beállításokban.",
  ],
  is: [
    "Veldu þjónustuveitanda",
    "Veldu fyrst þjónustuveitanda",
    "Veldu AI-þjónustuveitanda í stillingum áður en þú þýðir.",
  ],
  it: [
    "Seleziona un provider",
    "Seleziona prima un provider",
    "Scegli un provider AI nelle preferenze prima di tradurre.",
  ],
  ja: [
    "プロバイダーを選択",
    "先にプロバイダーを選択してください",
    "翻訳する前に設定で AI プロバイダーを選択してください。",
  ],
  ko: ["공급자 선택", "먼저 공급자를 선택하세요", "번역하기 전에 설정에서 AI 공급자를 선택하세요."],
  lv: [
    "Izvēlieties pakalpojumu sniedzēju",
    "Vispirms izvēlieties pakalpojumu sniedzēju",
    "Pirms tulkošanas iestatījumos izvēlieties AI pakalpojumu sniedzēju.",
  ],
  nl: ["Kies een provider", "Kies eerst een provider", "Kies voordat je vertaalt een AI-provider in de instellingen."],
  no: ["Velg en leverandør", "Velg først en leverandør", "Velg en AI-leverandør i innstillingene før du oversetter."],
  pl: ["Wybierz dostawcę", "Najpierw wybierz dostawcę", "Przed tłumaczeniem wybierz dostawcę AI w ustawieniach."],
  pt_BR: [
    "Selecione um provedor",
    "Selecione primeiro um provedor",
    "Escolha um provedor de IA nas preferências antes de traduzir.",
  ],
  pt_PT: [
    "Selecione um fornecedor",
    "Selecione primeiro um fornecedor",
    "Escolha um fornecedor de IA nas preferências antes de traduzir.",
  ],
  ro: [
    "Selectați un furnizor",
    "Selectați mai întâi un furnizor",
    "Alegeți un furnizor AI din setări înainte de a traduce.",
  ],
  ru: ["Выберите провайдера", "Сначала выберите провайдера", "Перед переводом выберите провайдера ИИ в настройках."],
  sl: ["Izberite ponudnika", "Najprej izberite ponudnika", "Pred prevajanjem izberite ponudnika AI v nastavitvah."],
  sr: [
    "Изаберите пружаоца услуга",
    "Прво изаберите пружаоца услуга",
    "Пре превођења изаберите AI пружаоца услуга у подешавањима.",
  ],
  sv: [
    "Välj en leverantör",
    "Välj först en leverantör",
    "Välj en AI-leverantör i inställningarna innan du översätter.",
  ],
  th: ["เลือกผู้ให้บริการ", "เลือกผู้ให้บริการก่อน", "โปรดเลือกผู้ให้บริการ AI ในการตั้งค่าก่อนแปล"],
  tr: [
    "Bir sağlayıcı seçin",
    "Önce bir sağlayıcı seçin",
    "Çeviri yapmadan önce tercihlerden bir yapay zekâ sağlayıcısı seçin.",
  ],
  ug: [
    "بىر تەمىنلىگۈچى تاللاڭ",
    "ئاۋۋال بىر تەمىنلىگۈچى تاللاڭ",
    "تەرجىمە قىلىشتىن بۇرۇن تەڭشەكتىكى AI تەمىنلىگۈچىنى تاللاڭ.",
  ],
  uk: [
    "Виберіть постачальника",
    "Спочатку виберіть постачальника",
    "Перед перекладом виберіть постачальника ШІ в налаштуваннях.",
  ],
  vi: ["Chọn nhà cung cấp", "Hãy chọn nhà cung cấp trước", "Hãy chọn nhà cung cấp AI trong cài đặt trước khi dịch."],
};

const KEYS = ["providerPlaceholder", "providerRequiredForModel", "providerRequiredError"];
const SKIP = new Set(["en", "zh_CN", "zh_TW"]);

let count = 0;
for (const [code, values] of Object.entries(T)) {
  if (SKIP.has(code)) continue;
  const file = path.join(ROOT, "locales", code, "messages.json");
  const catalogue = JSON.parse(fs.readFileSync(file, "utf8"));
  KEYS.forEach((key, index) => {
    if (!catalogue[key]) catalogue[key] = { message: values[index] };
  });
  fs.writeFileSync(file, JSON.stringify(catalogue, null, 2) + "\n");
  count += 1;
}
console.log(`[fill-provider-keys] ${count} locales updated`);
