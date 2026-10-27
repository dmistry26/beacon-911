// Pre-translated phrases used by the AI intake assistant and dispatcher quick replies.
// DEMO CONTENT: would be reviewed by certified medical interpreters before production use.
export const PHRASES = {
  en: {
    greet: '911, what is your emergency?',
    aiGreet: 'This is the 911 automated assistant. A dispatcher is monitoring this call.',
    qWhat: 'Please tell me what is happening.',
    known: 'We already know about the {kind} near {place}. Crews are responding.',
    qHurt: 'Is anyone hurt or trapped?',
    connecting: 'Connecting you to a dispatcher now. Stay on the line.',
    closing: 'Thank you. Your report is logged. Stay safe and follow instructions from officials.',
    takeover: 'A dispatcher is now on the line with you.',
    help: 'Help is on the way.',
    safety: 'Here is what to do to stay safe.',
  },
  es: {
    greet: '911, ¿cuál es su emergencia?',
    aiGreet: 'Este es el asistente automático del 911. Un despachador está supervisando esta llamada.',
    qWhat: 'Por favor, dígame qué está pasando.',
    known: 'Ya sabemos del {kind} cerca de {place}. Los equipos están respondiendo.',
    qHurt: '¿Hay alguien herido o atrapado?',
    connecting: 'Lo estamos conectando con un despachador. No cuelgue.',
    closing: 'Gracias. Su reporte quedó registrado. Manténgase a salvo y siga las instrucciones de las autoridades.',
    takeover: 'Un despachador está ahora en la línea con usted.',
    help: 'La ayuda va en camino.',
    safety: 'Esto es lo que debe hacer para mantenerse a salvo.',
  },
  vi: {
    greet: '911 đây, trường hợp khẩn cấp của bạn là gì?',
    aiGreet: 'Đây là trợ lý tự động của 911. Một điều phối viên đang theo dõi cuộc gọi này.',
    qWhat: 'Xin cho tôi biết chuyện gì đang xảy ra.',
    known: 'Chúng tôi đã biết về {kind} gần {place}. Lực lượng cứu hộ đang đến.',
    qHurt: 'Có ai bị thương hoặc bị kẹt không?',
    connecting: 'Đang kết nối bạn với điều phối viên. Xin đừng cúp máy.',
    closing: 'Cảm ơn bạn. Báo cáo của bạn đã được ghi nhận. Hãy giữ an toàn và làm theo hướng dẫn của nhà chức trách.',
    takeover: 'Điều phối viên hiện đã trên đường dây với bạn.',
    help: 'Lực lượng cứu hộ đang trên đường đến.',
    safety: 'Đây là những việc bạn cần làm để giữ an toàn.',
  },
  zh: {
    greet: '911，请问您遇到什么紧急情况？',
    aiGreet: '这里是911自动助手。调度员正在监听此通话。',
    qWhat: '请告诉我发生了什么。',
    known: '我们已经知道{place}附近的{kind}。救援人员正在赶往现场。',
    qHurt: '有人受伤或被困吗？',
    connecting: '正在为您转接调度员，请不要挂断。',
    closing: '谢谢。您的报告已记录。请注意安全，并听从官方指示。',
    takeover: '调度员现已接入通话。',
    help: '救援人员正在赶来。',
    safety: '为了您的安全，请这样做。',
  },
  tl: {
    greet: '911, ano po ang emergency ninyo?',
    aiGreet: 'Ito ang automated assistant ng 911. Isang dispatcher ang nakikinig sa tawag na ito.',
    qWhat: 'Pakisabi po kung ano ang nangyayari.',
    known: 'Alam na namin ang {kind} malapit sa {place}. Rumeresponde na ang mga tauhan.',
    qHurt: 'May nasaktan o naipit ba?',
    connecting: 'Ikinokonekta ko po kayo sa dispatcher. Huwag po kayong magbaba ng telepono.',
    closing: 'Salamat po. Naitala na ang inyong ulat. Manatiling ligtas at sundin ang mga tagubilin ng mga awtoridad.',
    takeover: 'Nasa linya na po ang isang dispatcher.',
    help: 'Papunta na po ang tulong.',
    safety: 'Ito ang dapat ninyong gawin para manatiling ligtas.',
  },
  hi: {
    greet: '911, आपकी आपातकालीन स्थिति क्या है?',
    aiGreet: 'यह 911 का स्वचालित सहायक है। एक डिस्पैचर इस कॉल की निगरानी कर रहा है।',
    qWhat: 'कृपया बताइए क्या हो रहा है।',
    known: 'हमें {place} के पास {kind} की जानकारी है। दल मौके पर पहुँच रहे हैं।',
    qHurt: 'क्या कोई घायल या फँसा हुआ है?',
    connecting: 'आपको डिस्पैचर से जोड़ा जा रहा है। कृपया लाइन पर बने रहें।',
    closing: 'धन्यवाद। आपकी रिपोर्ट दर्ज कर ली गई है। सुरक्षित रहें और अधिकारियों के निर्देशों का पालन करें।',
    takeover: 'अब एक डिस्पैचर आपके साथ लाइन पर है।',
    help: 'मदद रास्ते में है।',
    safety: 'सुरक्षित रहने के लिए यह करें।',
  },
};
PHRASES.mix = PHRASES.es; // Mixteco/Triqui callers get Spanish + interpreter bridge

export const KINDS = {
  en: { fire: 'fire', quake: 'earthquake damage', crash: 'crash', gas: 'gas leak', flood: 'flooding', other: 'incident' },
  es: { fire: 'incendio', quake: 'daño por el terremoto', crash: 'accidente', gas: 'fuga de gas', flood: 'inundación', other: 'incidente' },
  vi: { fire: 'đám cháy', quake: 'thiệt hại do động đất', crash: 'vụ tai nạn', gas: 'vụ rò rỉ gas', flood: 'vụ ngập lụt', other: 'sự cố' },
  zh: { fire: '火灾', quake: '地震损毁', crash: '事故', gas: '燃气泄漏', flood: '洪水', other: '事件' },
  tl: { fire: 'sunog', quake: 'pinsala ng lindol', crash: 'aksidente', gas: 'gas leak', flood: 'baha', other: 'insidente' },
  hi: { fire: 'आग', quake: 'भूकंप से नुकसान', crash: 'दुर्घटना', gas: 'गैस रिसाव', flood: 'बाढ़', other: 'घटना' },
};
KINDS.mix = KINDS.es;

export function phrase(lang, key, vars = {}) {
  const table = PHRASES[lang] || PHRASES.en;
  let s = table[key] ?? PHRASES.en[key] ?? '';
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
  return s;
}

// Structured silent / tap reports -> canonical English sentence
export const TAP_EN = {
  'fire.house': 'There is a fire in a house or building.',
  'fire.outdoor': 'There is a brush or outdoor fire.',
  'fire.vehicle': 'A vehicle is on fire.',
  'medical.notbreathing': 'Someone is not breathing and needs CPR.',
  'medical.bleeding': 'Someone is bleeding badly.',
  'medical.heart': 'Someone has chest pain.',
  'medical.unconscious': 'Someone passed out and is unresponsive.',
  'medical.baby': 'A woman is having a baby.',
  'medical.sick': 'Someone is sick or hurt.',
  'police.weapon': 'There is a person with a weapon or a threat.',
  'police.breakin': 'Someone is breaking in.',
  'police.fight': 'There is a fight or assault.',
  'crash.carcrash': 'There was a car crash.',
  'crash.pedhit': 'A person was hit by a vehicle.',
  'other.gas': 'I smell gas.',
  'other.flood': 'There is flooding.',
  'other.collapse': 'A building collapsed.',
  'other.unsure': 'I need help but I am not sure what to report.',
};
