// Surge simulator: replays a scripted multilingual wildfire scenario through the SAME
// pipeline real calls use (AI intake -> triage -> clustering -> hazard deltas).
import { S, newCall, callerText, setMode, audit, touch, endCall } from './engine.js';
import { gauss, offsetLL, pick, rnd } from './util.js';

const L = (en, es, vi, zh, tl, hi) => ({ en, es, vi, zh, tl, hi });

const T = {
  fire1: L('There is a big fire in a house across the street. Flames are coming out of the roof.', 'Hay un incendio grande en una casa al otro lado de la calle. Salen llamas del techo.', 'Có một đám cháy lớn ở ngôi nhà bên kia đường. Lửa bốc ra từ mái nhà.', '街对面有一栋房子起了大火，屋顶在冒火苗。', 'May malaking sunog sa bahay sa kabilang kalye. Lumalabas ang apoy sa bubong.', 'सड़क के उस पार एक घर में भयंकर आग लगी है। छत से लपटें निकल रही हैं।'),
  fire2: L('I see heavy smoke and flames at the house next to mine. It is spreading to the trees.', 'Veo mucho humo y llamas en la casa de al lado. Se está extendiendo a los árboles.', 'Tôi thấy nhiều khói và lửa ở nhà bên cạnh. Lửa đang lan sang cây cối.', '我看到隔壁房子冒出浓烟和火焰，火势正蔓延到树上。', 'Nakakita ako ng makapal na usok at apoy sa katabing bahay. Kumakalat na sa mga puno.', 'मुझे बगल के घर में घना धुआँ और लपटें दिख रही हैं। आग पेड़ों तक फैल रही है।'),
  fire3: L('A brush fire is moving fast toward our street. The wind is pushing it.', 'Un incendio de maleza avanza rápido hacia nuestra calle. El viento lo empuja.', 'Đám cháy bụi rậm đang lan nhanh về phía đường của chúng tôi. Gió đang thổi nó đi.', '灌木丛大火正朝我们这条街快速蔓延，风在助长火势。', 'Mabilis na papalapit sa aming kalye ang sunog sa damuhan. Tinutulak ito ng hangin.', 'झाड़ियों की आग तेज़ी से हमारी गली की ओर बढ़ रही है। हवा उसे धकेल रही है।'),
  smoke: L('The air is full of smoke and I can see fire on the hill. Do we need to evacuate?', 'El aire está lleno de humo y veo fuego en el cerro. ¿Tenemos que evacuar?', 'Không khí đầy khói và tôi thấy lửa trên đồi. Chúng tôi có cần sơ tán không?', '空气里全是烟，我看到山上有火。我们需要撤离吗？', 'Puno ng usok ang hangin at may nakikita akong apoy sa burol. Kailangan ba naming lumikas?', 'हवा धुएँ से भरी है और पहाड़ी पर आग दिख रही है। क्या हमें निकासी करनी चाहिए?'),
  medsmoke: L('My mother is coughing badly from the smoke and cannot catch her breath.', 'Mi mamá tose muy fuerte por el humo y no puede respirar bien.', 'Mẹ tôi ho dữ dội vì khói và không thở được.', '我妈妈被烟呛得咳得很厉害，喘不上气。', 'Ubo nang ubo ang nanay ko dahil sa usok at hindi siya makahinga.', 'मेरी माँ धुएँ की वजह से बहुत खाँस रही हैं और साँस नहीं ले पा रही हैं।'),
  trap: L('My neighbor is trapped on the second floor of the burning house. He cannot get down the stairs.', 'Mi vecino está atrapado en el segundo piso de la casa en llamas. No puede bajar las escaleras.', 'Người hàng xóm của tôi bị kẹt trên tầng hai của ngôi nhà đang cháy. Ông ấy không xuống cầu thang được.', '我的邻居被困在着火房子的二楼，他下不了楼梯。', 'Naipit ang kapitbahay ko sa ikalawang palapag ng nasusunog na bahay. Hindi siya makababa sa hagdan.', 'मेरा पड़ोसी जलते हुए घर की दूसरी मंज़िल पर फँसा है। वह सीढ़ियों से नीचे नहीं आ सकता।'),
  propane: L('There is a propane tank in the backyard of the burning house. It could explode.', 'Hay un tanque de propano en el patio trasero de la casa que se quema. Podría explotar.', 'Có bình propane ở sân sau của ngôi nhà đang cháy. Nó có thể phát nổ.', '着火房子的后院有一个丙烷罐，可能会爆炸。', 'May propane tank sa likod-bahay ng nasusunog na bahay. Maaari itong sumabog.', 'जलते हुए घर के पिछवाड़े में प्रोपेन टैंक है। वह फट सकता है।'),
  wheel: L('My grandmother uses a wheelchair and we cannot get her out. The fire is two houses away.', 'Mi abuela usa silla de ruedas y no podemos sacarla. El fuego está a dos casas de distancia.', 'Bà tôi dùng xe lăn và chúng tôi không đưa bà ra ngoài được. Lửa chỉ cách hai nhà.', '我奶奶坐轮椅，我们没办法带她出去。火离我们只有两栋房子。', 'Naka-wheelchair ang lola ko at hindi namin siya mailabas. Dalawang bahay na lang ang layo ng apoy.', 'मेरी दादी व्हीलचेयर पर हैं और हम उन्हें बाहर नहीं निकाल पा रहे। आग दो घर दूर है।'),
  cardiac: L('My husband collapsed and he is not breathing!', '¡Mi esposo se desplomó y no respira!', 'Chồng tôi ngã quỵ và không thở!', '我丈夫倒下了，没有呼吸！', 'Bumagsak ang asawa ko at hindi siya humihinga!', 'मेरे पति गिर गए और साँस नहीं ले रहे!'),
  crash: L('There was a bad car crash on Highway 17. Two cars, one person is bleeding.', 'Hubo un choque grave en la carretera 17. Dos autos, una persona está sangrando.', 'Có vụ tai nạn xe nghiêm trọng trên đường cao tốc 17. Hai xe, một người đang chảy máu.', '17号公路发生严重车祸。两辆车，有一个人在流血。', 'May malubhang banggaan sa Highway 17. Dalawang sasakyan, may isang taong dumudugo.', 'हाईवे 17 पर भीषण कार दुर्घटना हुई। दो गाड़ियाँ, एक व्यक्ति का खून बह रहा है।'),
  gas: L('I smell gas strongly near the school and I feel dizzy.', 'Huelo mucho gas cerca de la escuela y me siento mareado.', 'Tôi ngửi thấy mùi gas nồng gần trường học và cảm thấy chóng mặt.', '我在学校附近闻到很浓的燃气味，还觉得头晕。', 'Amoy na amoy ko ang gas malapit sa paaralan at nahihilo ako.', 'मुझे स्कूल के पास गैस की तेज़ गंध आ रही है और चक्कर आ रहा है।'),
};
// Second line from the caller, chosen by what happened in the call:
//  - AI still asking ("anyone hurt or trapped?")  -> a calm answer that fits the report
//  - already escalated to a dispatcher            -> an urgent follow-up that fits the report
const SAFE = {
  out: L('No, everyone got out. We are across the street.', 'No, todos salimos. Estamos al otro lado de la calle.', 'Không, mọi người đã ra ngoài. Chúng tôi đang ở bên kia đường.', '没有，大家都出来了。我们在街对面。', 'Wala po, nakalabas na kaming lahat. Nasa kabilang kalye kami.', 'नहीं, सब बाहर निकल आए हैं। हम सड़क के उस पार हैं।'),
  left: L("I don't think so. The family already left the house.", 'Creo que no. La familia ya salió de la casa.', 'Tôi nghĩ là không. Gia đình đó đã rời khỏi nhà rồi.', '应该没有。那家人已经离开房子了。', 'Sa tingin ko wala po. Nakaalis na ang pamilya sa bahay.', 'मुझे नहीं लगता। परिवार पहले ही घर से निकल चुका है।'),
  thick: L('Everyone is okay, but the smoke is getting very thick here.', 'Todos estamos bien, pero el humo se está poniendo muy espeso aquí.', 'Mọi người đều ổn, nhưng khói ở đây ngày càng dày.', '大家都没事，但这里的烟越来越浓了。', 'Okay naman po kaming lahat, pero kumakapal na ang usok dito.', 'सब ठीक हैं, लेकिन यहाँ धुआँ बहुत घना होता जा रहा है।'),
  packing: L('No. We are packing the car to leave now.', 'No. Estamos subiendo cosas al carro para irnos ya.', 'Không. Chúng tôi đang chất đồ lên xe để đi ngay.', '没有。我们正在收拾东西上车，准备马上离开。', 'Wala po. Nag-iimpake na kami ng sasakyan para umalis.', 'नहीं। हम अभी निकलने के लिए गाड़ी में सामान रख रहे हैं।'),
  gas: L('I feel a little dizzy, but I walked outside.', 'Me siento un poco mareado, pero ya salí afuera.', 'Tôi hơi chóng mặt, nhưng tôi đã ra ngoài rồi.', '我有点头晕，但已经走到外面了。', 'Medyo nahihilo ako, pero nakalabas na ako.', 'मुझे थोड़ा चक्कर आ रहा है, लेकिन मैं बाहर आ गया हूँ।'),
};
const SAFE_FOR = { fire1: ['out', 'left', 'packing'], fire2: ['out', 'left', 'thick'], fire3: ['thick', 'packing', 'out'], smoke: ['thick', 'packing'], gas: ['gas'] };
const URGENT = {
  trap: L('He is at the window waving for help. Please hurry!', 'Está en la ventana pidiendo ayuda con las manos. ¡Por favor, apúrense!', 'Ông ấy đang ở cửa sổ vẫy tay cầu cứu. Làm ơn nhanh lên!', '他在窗边挥手求救。请快一点！', 'Nasa bintana siya, kumakaway para humingi ng tulong. Pakibilisan po!', 'वह खिड़की पर हाथ हिलाकर मदद माँग रहा है। कृपया जल्दी कीजिए!'),
  propane: L('The flames are getting close to the tank. Everyone on the street is backing away.', 'Las llamas se están acercando al tanque. Todos en la calle se están alejando.', 'Lửa đang lan gần tới bình gas. Mọi người trên phố đang lùi ra xa.', '火焰离罐子越来越近了。街上的人都在往后退。', 'Papalapit na ang apoy sa tangke. Umaatras na ang lahat sa kalye.', 'लपटें टैंक के करीब पहुँच रही हैं। गली के सब लोग पीछे हट रहे हैं।'),
  wheel: L('Please hurry. The smoke is coming into the house.', 'Por favor, apúrense. El humo está entrando a la casa.', 'Làm ơn nhanh lên. Khói đang tràn vào nhà.', '请快一点。烟已经进到屋里了。', 'Pakibilisan po. Pumapasok na ang usok sa bahay.', 'कृपया जल्दी कीजिए। धुआँ घर के अंदर आ रहा है।'),
  medsmoke: L('She is sitting down now but her lips look pale. Please hurry.', 'Ya está sentada, pero tiene los labios pálidos. Por favor, apúrense.', 'Bà ấy đang ngồi nhưng môi trông nhợt nhạt. Làm ơn nhanh lên.', '她现在坐下了，但嘴唇看起来发白。请快一点。', 'Nakaupo na siya pero maputla ang labi niya. Pakibilisan po.', 'वह अब बैठी हैं लेकिन उनके होंठ पीले दिख रहे हैं। कृपया जल्दी कीजिए।'),
  cardiac: L('I am pushing on his chest. Please tell me what to do!', 'Le estoy presionando el pecho. ¡Por favor, dígame qué hacer!', 'Tôi đang ấn ngực ông ấy. Làm ơn chỉ tôi phải làm gì!', '我正在按压他的胸口。请告诉我该怎么做！', 'Pinipindot ko ang dibdib niya. Pakisabi po kung ano ang gagawin ko!', 'मैं उनकी छाती दबा रही हूँ। कृपया बताइए मुझे क्या करना है!'),
  crash: L('The driver is awake but his leg is pinned under the dashboard.', 'El conductor está despierto, pero tiene la pierna atrapada bajo el tablero.', 'Tài xế còn tỉnh nhưng chân bị kẹt dưới bảng điều khiển.', '司机还清醒，但腿被卡在仪表盘下面。', 'Gising ang drayber pero naipit ang binti niya sa ilalim ng dashboard.', 'ड्राइवर होश में है लेकिन उसका पैर डैशबोर्ड के नीचे फँसा है।'),
};

const STREETS = ['Highway 9', 'Glen Arbor Rd', 'Love Creek Rd', 'Alba Rd', 'Mill St', 'Hillside Ave', 'Fremont Ave', 'Kirby St', 'Gushee St', 'Hubbard Gulch Rd'];
const LANG_MIX = ['es', 'es', 'es', 'es', 'es', 'en', 'en', 'vi', 'vi', 'zh', 'tl', 'tl', 'hi'];

const CENTER = { lat: 37.0835, lng: -122.0815 }; // between Ben Lomond and Felton, Santa Cruz Mountains (CZU fire area, 2020)

function addr(loc) {
  const n = 100 + Math.floor(Math.abs((loc.lat * 1e5) % 90)) * 20 + Math.floor(Math.abs((loc.lng * 1e5) % 9)) * 2;
  return `${n} ${STREETS[Math.floor(Math.abs(loc.lng * 1e4) % STREETS.length)]}, Ben Lomond`;
}

function spawn(spec) {
  const { key, lang, loc, hangup = false, city = 'Ben Lomond' } = spec;
  const text = T[key];
  const call = newCall({ lang, mode: 'voice', loc: { ...loc, acc: 12, source: 'sim', address: spec.address || addr(loc), city }, source: 'sim', forceIntake: true });
  const say = (line) => callerText(call, line[lang], { pre: line.en, sttMs: Math.round(rnd(120, 300)) });
  setTimeout(() => {
    say(text);
    if (hangup) { setTimeout(() => endCall(call.id, 'caller'), rnd(900, 1800)); return; }
    // reply to whatever the AI just did with this call
    setTimeout(() => {
      if (call.state === 'escalated' && URGENT[key]) say(URGENT[key]);
      else if (call.state === 'intake') say(SAFE[pick(SAFE_FOR[key] || ['out'])]);
    }, rnd(1800, 3000));
  }, 650);
  S.sim.spawned++;
  touch();
  return call;
}

let timers = [];

export function stopSim() {
  timers.forEach(clearTimeout); timers = [];
  S.sim.running = false;
  audit('DISPATCHER', 'sim.stop', 'Surge simulation stopped');
  touch();
}

export function startSim(scenario = 'wildfire') {
  stopSim();
  setMode('surge');
  const N = 52;
  S.sim = { running: true, scenario, total: N, spawned: 0, startedAt: Date.now() };
  audit('DISPATCHER', 'sim.start', `Surge simulation: ${scenario} — ${N} calls over ~60 s`);

  const plan = [];
  for (let i = 0; i < N; i++) {
    const u = (i + 1) / N;
    const t = 60000 * Math.pow(u, 1.5) + rnd(0, 400);
    const lang = pick(LANG_MIX);
    const r = Math.random();
    let key = r < 0.34 ? 'fire1' : r < 0.58 ? 'fire2' : r < 0.74 ? 'fire3' : r < 0.9 ? 'smoke' : 'medsmoke';
    const loc = offsetLL(CENTER.lat, CENTER.lng, gauss() * (key === 'fire3' ? 700 : 280), gauss() * (key === 'fire3' ? 700 : 280));
    plan.push({ t, lang, key, loc, hangup: Math.random() < 0.1 });
  }
  // Hazard-delta calls (the point of the demo) at fixed positions in the flood
  const bump = (idx, lang, key, dx, dy) => { plan[idx] = { t: plan[idx].t + 200, lang, key, loc: offsetLL(CENTER.lat, CENTER.lng, dx, dy), hangup: false, special: true }; };
  bump(11, 'vi', 'trap', 40, 25);
  bump(18, 'es', 'propane', 20, 40);
  bump(27, 'tl', 'wheel', -90, 60);
  // Unrelated emergencies that must NOT be absorbed into the fire
  const far = (idx, lang, key, lat, lng) => { plan[idx] = { t: plan[idx].t, lang, key, loc: { lat, lng }, hangup: false, city: key === 'cardiac' ? 'Monterey' : key === 'crash' ? 'Santa Cruz' : 'Santa Cruz', special: true }; };
  far(8, 'es', 'cardiac', 36.6008, -121.8946);   // Monterey
  far(22, 'en', 'crash', 37.0040, -122.0230);    // Highway 17 near Pasatiempo
  far(33, 'es', 'gas', 36.9712, -122.0385);      // Santa Cruz

  for (const p of plan) {
    timers.push(setTimeout(() => {
      spawn({ key: p.key, lang: p.lang, loc: p.loc, hangup: p.hangup, city: p.city || 'Ben Lomond', address: p.key === 'cardiac' ? '450 Alvarado St, Monterey' : p.key === 'crash' ? 'Hwy 17 near Pasatiempo, Santa Cruz' : p.key === 'gas' ? 'Bay St near Bay View Elementary, Santa Cruz' : undefined });
      if (S.sim.spawned >= N) { S.sim.running = false; touch(); }
    }, p.t));
  }
  touch();
}
