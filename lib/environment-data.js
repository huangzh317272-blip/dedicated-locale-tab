const RAW_REGION_PRESETS = [
  // 北美
  ["美国 · 纽约", "America/New_York", "en-US"],
  ["美国 · 芝加哥", "America/Chicago", "en-US"],
  ["美国 · 丹佛", "America/Denver", "en-US"],
  ["美国 · 凤凰城", "America/Phoenix", "en-US"],
  ["美国 · 洛杉矶", "America/Los_Angeles", "en-US"],
  ["美国 · 安克雷奇", "America/Anchorage", "en-US"],
  ["美国 · 檀香山", "Pacific/Honolulu", "en-US"],
  ["加拿大 · 多伦多", "America/Toronto", "en-CA"],
  ["加拿大 · 蒙特利尔（法语）", "America/Toronto", "fr-CA"],
  ["加拿大 · 温尼伯", "America/Winnipeg", "en-CA"],
  ["加拿大 · 埃德蒙顿", "America/Edmonton", "en-CA"],
  ["加拿大 · 温哥华", "America/Vancouver", "en-CA"],
  ["加拿大 · 哈利法克斯", "America/Halifax", "en-CA"],
  ["加拿大 · 圣约翰斯", "America/St_Johns", "en-CA"],
  ["墨西哥 · 墨西哥城", "America/Mexico_City", "es-MX"],
  ["墨西哥 · 蒂华纳", "America/Tijuana", "es-MX"],
  ["墨西哥 · 坎昆", "America/Cancun", "es-MX"],
  ["格陵兰 · 努克", "America/Nuuk", "kl-GL"],
  ["百慕大 · 汉密尔顿", "Atlantic/Bermuda", "en-BM"],

  // 中美洲与加勒比
  ["巴拿马 · 巴拿马城", "America/Panama", "es-PA"],
  ["哥斯达黎加 · 圣何塞", "America/Costa_Rica", "es-CR"],
  ["危地马拉 · 危地马拉城", "America/Guatemala", "es-GT"],
  ["萨尔瓦多 · 圣萨尔瓦多", "America/El_Salvador", "es-SV"],
  ["洪都拉斯 · 特古西加尔巴", "America/Tegucigalpa", "es-HN"],
  ["尼加拉瓜 · 马那瓜", "America/Managua", "es-NI"],
  ["伯利兹 · 贝尔莫潘", "America/Belize", "en-BZ"],
  ["牙买加 · 金斯敦", "America/Jamaica", "en-JM"],
  ["古巴 · 哈瓦那", "America/Havana", "es-CU"],
  ["波多黎各 · 圣胡安", "America/Puerto_Rico", "es-PR"],
  ["多米尼加 · 圣多明各", "America/Santo_Domingo", "es-DO"],
  ["巴哈马 · 拿骚", "America/Nassau", "en-BS"],
  ["特立尼达和多巴哥 · 西班牙港", "America/Port_of_Spain", "en-TT"],

  // 南美洲
  ["巴西 · 圣保罗", "America/Sao_Paulo", "pt-BR"],
  ["巴西 · 玛瑙斯", "America/Manaus", "pt-BR"],
  ["巴西 · 里奥布兰科", "America/Rio_Branco", "pt-BR"],
  ["阿根廷 · 布宜诺斯艾利斯", "America/Argentina/Buenos_Aires", "es-AR"],
  ["智利 · 圣地亚哥", "America/Santiago", "es-CL"],
  ["哥伦比亚 · 波哥大", "America/Bogota", "es-CO"],
  ["秘鲁 · 利马", "America/Lima", "es-PE"],
  ["厄瓜多尔 · 基多", "America/Guayaquil", "es-EC"],
  ["委内瑞拉 · 加拉加斯", "America/Caracas", "es-VE"],
  ["乌拉圭 · 蒙得维的亚", "America/Montevideo", "es-UY"],
  ["巴拉圭 · 亚松森", "America/Asuncion", "es-PY"],
  ["玻利维亚 · 拉巴斯", "America/La_Paz", "es-BO"],
  ["圭亚那 · 乔治敦", "America/Guyana", "en-GY"],
  ["苏里南 · 帕拉马里博", "America/Paramaribo", "nl-SR"],

  // 西欧与北欧
  ["英国 · 伦敦", "Europe/London", "en-GB"],
  ["爱尔兰 · 都柏林", "Europe/Dublin", "en-IE"],
  ["葡萄牙 · 里斯本", "Europe/Lisbon", "pt-PT"],
  ["葡萄牙 · 亚速尔群岛", "Atlantic/Azores", "pt-PT"],
  ["西班牙 · 马德里", "Europe/Madrid", "es-ES"],
  ["西班牙 · 巴塞罗那（加泰罗尼亚语）", "Europe/Madrid", "ca-ES"],
  ["法国 · 巴黎", "Europe/Paris", "fr-FR"],
  ["比利时 · 布鲁塞尔（荷兰语）", "Europe/Brussels", "nl-BE"],
  ["比利时 · 布鲁塞尔（法语）", "Europe/Brussels", "fr-BE"],
  ["荷兰 · 阿姆斯特丹", "Europe/Amsterdam", "nl-NL"],
  ["卢森堡 · 卢森堡", "Europe/Luxembourg", "fr-LU"],
  ["德国 · 柏林", "Europe/Berlin", "de-DE"],
  ["瑞士 · 苏黎世（德语）", "Europe/Zurich", "de-CH"],
  ["瑞士 · 日内瓦（法语）", "Europe/Zurich", "fr-CH"],
  ["奥地利 · 维也纳", "Europe/Vienna", "de-AT"],
  ["意大利 · 罗马", "Europe/Rome", "it-IT"],
  ["丹麦 · 哥本哈根", "Europe/Copenhagen", "da-DK"],
  ["挪威 · 奥斯陆", "Europe/Oslo", "nb-NO"],
  ["瑞典 · 斯德哥尔摩", "Europe/Stockholm", "sv-SE"],
  ["芬兰 · 赫尔辛基", "Europe/Helsinki", "fi-FI"],
  ["冰岛 · 雷克雅未克", "Atlantic/Reykjavik", "is-IS"],
  ["马耳他 · 瓦莱塔", "Europe/Malta", "mt-MT"],

  // 中东欧与巴尔干
  ["波兰 · 华沙", "Europe/Warsaw", "pl-PL"],
  ["捷克 · 布拉格", "Europe/Prague", "cs-CZ"],
  ["斯洛伐克 · 布拉迪斯拉发", "Europe/Bratislava", "sk-SK"],
  ["匈牙利 · 布达佩斯", "Europe/Budapest", "hu-HU"],
  ["罗马尼亚 · 布加勒斯特", "Europe/Bucharest", "ro-RO"],
  ["保加利亚 · 索非亚", "Europe/Sofia", "bg-BG"],
  ["希腊 · 雅典", "Europe/Athens", "el-GR"],
  ["克罗地亚 · 萨格勒布", "Europe/Zagreb", "hr-HR"],
  ["斯洛文尼亚 · 卢布尔雅那", "Europe/Ljubljana", "sl-SI"],
  ["塞尔维亚 · 贝尔格莱德", "Europe/Belgrade", "sr-RS"],
  ["波黑 · 萨拉热窝", "Europe/Sarajevo", "bs-BA"],
  ["黑山 · 波德戈里察", "Europe/Podgorica", "sr-ME"],
  ["阿尔巴尼亚 · 地拉那", "Europe/Tirane", "sq-AL"],
  ["北马其顿 · 斯科普里", "Europe/Skopje", "mk-MK"],
  ["爱沙尼亚 · 塔林", "Europe/Tallinn", "et-EE"],
  ["拉脱维亚 · 里加", "Europe/Riga", "lv-LV"],
  ["立陶宛 · 维尔纽斯", "Europe/Vilnius", "lt-LT"],
  ["摩尔多瓦 · 基希讷乌", "Europe/Chisinau", "ro-MD"],
  ["乌克兰 · 基辅", "Europe/Kyiv", "uk-UA"],
  ["白俄罗斯 · 明斯克", "Europe/Minsk", "be-BY"],
  ["俄罗斯 · 莫斯科", "Europe/Moscow", "ru-RU"],
  ["俄罗斯 · 加里宁格勒", "Europe/Kaliningrad", "ru-RU"],
  ["俄罗斯 · 叶卡捷琳堡", "Asia/Yekaterinburg", "ru-RU"],
  ["俄罗斯 · 新西伯利亚", "Asia/Novosibirsk", "ru-RU"],
  ["俄罗斯 · 符拉迪沃斯托克", "Asia/Vladivostok", "ru-RU"],

  // 东亚与东南亚
  ["中国大陆 · 上海", "Asia/Shanghai", "zh-CN"],
  ["中国香港 · 香港", "Asia/Hong_Kong", "zh-HK"],
  ["中国澳门 · 澳门", "Asia/Macau", "zh-MO"],
  ["中国台湾 · 台北", "Asia/Taipei", "zh-TW"],
  ["日本 · 东京", "Asia/Tokyo", "ja-JP"],
  ["韩国 · 首尔", "Asia/Seoul", "ko-KR"],
  ["蒙古 · 乌兰巴托", "Asia/Ulaanbaatar", "mn-MN"],
  ["新加坡 · 新加坡", "Asia/Singapore", "en-SG"],
  ["马来西亚 · 吉隆坡", "Asia/Kuala_Lumpur", "ms-MY"],
  ["印度尼西亚 · 雅加达", "Asia/Jakarta", "id-ID"],
  ["印度尼西亚 · 马卡萨", "Asia/Makassar", "id-ID"],
  ["印度尼西亚 · 查亚普拉", "Asia/Jayapura", "id-ID"],
  ["泰国 · 曼谷", "Asia/Bangkok", "th-TH"],
  ["越南 · 胡志明市", "Asia/Ho_Chi_Minh", "vi-VN"],
  ["菲律宾 · 马尼拉", "Asia/Manila", "fil-PH"],
  ["柬埔寨 · 金边", "Asia/Phnom_Penh", "km-KH"],
  ["老挝 · 万象", "Asia/Vientiane", "lo-LA"],
  ["缅甸 · 仰光", "Asia/Yangon", "my-MM"],
  ["文莱 · 斯里巴加湾", "Asia/Brunei", "ms-BN"],
  ["东帝汶 · 帝力", "Asia/Dili", "pt-TL"],

  // 南亚与中亚
  ["印度 · 新德里（印地语）", "Asia/Kolkata", "hi-IN"],
  ["印度 · 孟买（英语）", "Asia/Kolkata", "en-IN"],
  ["巴基斯坦 · 卡拉奇", "Asia/Karachi", "ur-PK"],
  ["孟加拉国 · 达卡", "Asia/Dhaka", "bn-BD"],
  ["尼泊尔 · 加德满都", "Asia/Kathmandu", "ne-NP"],
  ["斯里兰卡 · 科伦坡", "Asia/Colombo", "si-LK"],
  ["不丹 · 廷布", "Asia/Thimphu", "dz-BT"],
  ["马尔代夫 · 马累", "Indian/Maldives", "dv-MV"],
  ["哈萨克斯坦 · 阿拉木图", "Asia/Almaty", "kk-KZ"],
  ["乌兹别克斯坦 · 塔什干", "Asia/Tashkent", "uz-UZ"],
  ["吉尔吉斯斯坦 · 比什凯克", "Asia/Bishkek", "ky-KG"],
  ["塔吉克斯坦 · 杜尚别", "Asia/Dushanbe", "tg-TJ"],
  ["土库曼斯坦 · 阿什哈巴德", "Asia/Ashgabat", "tk-TM"],
  ["阿富汗 · 喀布尔", "Asia/Kabul", "fa-AF"],

  // 高加索与中东
  ["格鲁吉亚 · 第比利斯", "Asia/Tbilisi", "ka-GE"],
  ["亚美尼亚 · 埃里温", "Asia/Yerevan", "hy-AM"],
  ["阿塞拜疆 · 巴库", "Asia/Baku", "az-AZ"],
  ["土耳其 · 伊斯坦布尔", "Europe/Istanbul", "tr-TR"],
  ["以色列 · 特拉维夫", "Asia/Jerusalem", "he-IL"],
  ["阿联酋 · 迪拜", "Asia/Dubai", "ar-AE"],
  ["沙特阿拉伯 · 利雅得", "Asia/Riyadh", "ar-SA"],
  ["卡塔尔 · 多哈", "Asia/Qatar", "ar-QA"],
  ["巴林 · 麦纳麦", "Asia/Bahrain", "ar-BH"],
  ["科威特 · 科威特城", "Asia/Kuwait", "ar-KW"],
  ["阿曼 · 马斯喀特", "Asia/Muscat", "ar-OM"],
  ["约旦 · 安曼", "Asia/Amman", "ar-JO"],
  ["黎巴嫩 · 贝鲁特", "Asia/Beirut", "ar-LB"],
  ["伊拉克 · 巴格达", "Asia/Baghdad", "ar-IQ"],
  ["伊朗 · 德黑兰", "Asia/Tehran", "fa-IR"],
  ["塞浦路斯 · 尼科西亚", "Asia/Nicosia", "el-CY"],

  // 非洲
  ["南非 · 约翰内斯堡", "Africa/Johannesburg", "en-ZA"],
  ["埃及 · 开罗", "Africa/Cairo", "ar-EG"],
  ["摩洛哥 · 卡萨布兰卡", "Africa/Casablanca", "ar-MA"],
  ["阿尔及利亚 · 阿尔及尔", "Africa/Algiers", "ar-DZ"],
  ["突尼斯 · 突尼斯", "Africa/Tunis", "ar-TN"],
  ["尼日利亚 · 拉各斯", "Africa/Lagos", "en-NG"],
  ["肯尼亚 · 内罗毕", "Africa/Nairobi", "en-KE"],
  ["埃塞俄比亚 · 亚的斯亚贝巴", "Africa/Addis_Ababa", "am-ET"],
  ["加纳 · 阿克拉", "Africa/Accra", "en-GH"],
  ["坦桑尼亚 · 达累斯萨拉姆", "Africa/Dar_es_Salaam", "sw-TZ"],
  ["乌干达 · 坎帕拉", "Africa/Kampala", "en-UG"],
  ["塞内加尔 · 达喀尔", "Africa/Dakar", "fr-SN"],
  ["科特迪瓦 · 阿比让", "Africa/Abidjan", "fr-CI"],
  ["喀麦隆 · 雅温得", "Africa/Douala", "fr-CM"],
  ["安哥拉 · 罗安达", "Africa/Luanda", "pt-AO"],
  ["莫桑比克 · 马普托", "Africa/Maputo", "pt-MZ"],
  ["津巴布韦 · 哈拉雷", "Africa/Harare", "en-ZW"],
  ["赞比亚 · 卢萨卡", "Africa/Lusaka", "en-ZM"],
  ["毛里求斯 · 路易港", "Indian/Mauritius", "en-MU"],

  // 大洋洲
  ["澳大利亚 · 悉尼", "Australia/Sydney", "en-AU"],
  ["澳大利亚 · 墨尔本", "Australia/Melbourne", "en-AU"],
  ["澳大利亚 · 布里斯班", "Australia/Brisbane", "en-AU"],
  ["澳大利亚 · 阿德莱德", "Australia/Adelaide", "en-AU"],
  ["澳大利亚 · 达尔文", "Australia/Darwin", "en-AU"],
  ["澳大利亚 · 珀斯", "Australia/Perth", "en-AU"],
  ["新西兰 · 奥克兰", "Pacific/Auckland", "en-NZ"],
  ["斐济 · 苏瓦", "Pacific/Fiji", "en-FJ"],
  ["巴布亚新几内亚 · 莫尔兹比港", "Pacific/Port_Moresby", "en-PG"],
  ["关岛 · 阿加尼亚", "Pacific/Guam", "en-GU"],
  ["萨摩亚 · 阿皮亚", "Pacific/Apia", "sm-WS"],
  ["汤加 · 努库阿洛法", "Pacific/Tongatapu", "to-TO"],

  // 通用
  ["全球 · UTC", "UTC", "en-US"]
];

const BASE_LANGUAGE_TAGS = [
  "af-ZA", "am-ET", "ar-AE", "ar-BH", "ar-DZ", "ar-EG", "ar-IQ", "ar-JO",
  "ar-KW", "ar-LB", "ar-MA", "ar-OM", "ar-QA", "ar-SA", "ar-TN", "az-AZ",
  "be-BY", "bg-BG", "bn-BD", "bn-IN", "bs-BA", "ca-ES", "cs-CZ", "cy-GB",
  "da-DK", "de-AT", "de-CH", "de-DE", "dv-MV", "dz-BT", "el-CY", "el-GR",
  "en-AU", "en-BM", "en-BS", "en-BZ", "en-CA", "en-FJ", "en-GB", "en-GH",
  "en-GU", "en-GY", "en-IE", "en-IN", "en-JM", "en-KE", "en-MU", "en-NG",
  "en-NZ", "en-PG", "en-PH", "en-SG", "en-TT", "en-UG", "en-US", "en-ZA",
  "en-ZM", "en-ZW", "es-AR", "es-BO", "es-CL", "es-CO", "es-CR", "es-CU",
  "es-DO", "es-EC", "es-ES", "es-GT", "es-HN", "es-MX", "es-NI", "es-PA",
  "es-PE", "es-PR", "es-PY", "es-SV", "es-US", "es-UY", "es-VE", "et-EE",
  "fa-AF", "fa-IR", "fi-FI", "fil-PH", "fr-BE", "fr-CA", "fr-CH", "fr-CI",
  "fr-CM", "fr-FR", "fr-LU", "fr-SN", "ga-IE", "gu-IN", "he-IL", "hi-IN",
  "hr-HR", "hu-HU", "hy-AM", "id-ID", "is-IS", "it-IT", "ja-JP", "ka-GE",
  "kk-KZ", "kl-GL", "km-KH", "kn-IN", "ko-KR", "ky-KG", "lo-LA", "lt-LT",
  "lv-LV", "mk-MK", "ml-IN", "mn-MN", "mr-IN", "ms-BN", "ms-MY", "mt-MT",
  "my-MM", "nb-NO", "ne-NP", "nl-BE", "nl-NL", "nl-SR", "pa-IN", "pl-PL",
  "pt-AO", "pt-BR", "pt-MZ", "pt-PT", "pt-TL", "ro-MD", "ro-RO", "ru-RU",
  "si-LK", "sk-SK", "sl-SI", "sm-WS", "sq-AL", "sr-ME", "sr-RS", "sv-SE",
  "sw-KE", "sw-TZ", "ta-IN", "te-IN", "tg-TJ", "th-TH", "tk-TM", "to-TO",
  "tr-TR", "uk-UA", "ur-PK", "uz-UZ", "vi-VN", "zh-CN", "zh-Hans", "zh-Hant",
  "zh-HK", "zh-MO", "zh-SG", "zh-TW"
];

export const REGION_PRESETS = Object.freeze(
  RAW_REGION_PRESETS.map(([label, timezoneId, language], index) => Object.freeze({
    id: `region-${index + 1}`,
    label,
    timezoneId,
    language
  }))
);

export const LANGUAGE_TAGS = Object.freeze(
  [...new Set([
    ...BASE_LANGUAGE_TAGS,
    ...REGION_PRESETS.map((preset) => preset.language)
  ])].sort((left, right) => left.localeCompare(right))
);

export function getSupportedTimezones() {
  const runtimeTimezones = typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : [];

  return [...new Set([
    "UTC",
    ...runtimeTimezones,
    ...REGION_PRESETS.map((preset) => preset.timezoneId)
  ])].sort((left, right) => left.localeCompare(right));
}
