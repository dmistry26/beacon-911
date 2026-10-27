// Beacon protocol cards. DEMO CONTENT written from public first-aid guidance
// (AHA / Red Cross style). Steps are pre-translated so life-saving instructions
// play instantly and can never be altered by the AI. Translations should be
// reviewed by certified medical interpreters before real-world use.
const S = (en, es, vi, zh, tl, hi) => ({ en, es, vi, zh, tl, hi, mix: es });

export const CARDS = [
  {
    id: 'cpr', title: 'CPR · Not breathing', icon: '🫀', color: '#ff3b47', metronome: 110,
    questions: ['Is the person awake and responding?', 'Are they breathing normally?', 'How old is the patient?', 'Is an AED nearby?'],
    steps: [
      S('Lay the person flat on their back on a firm surface.', 'Acueste a la persona boca arriba sobre una superficie firme.', 'Đặt người bệnh nằm ngửa trên bề mặt cứng.', '让患者仰卧在坚硬的平面上。', 'Ihiga ang tao nang nakatihaya sa matigas na ibabaw.', 'व्यक्ति को सख्त सतह पर पीठ के बल लिटाएँ।'),
      S('Put the heel of your hand on the center of the chest. Put your other hand on top.', 'Ponga la base de su mano en el centro del pecho y la otra mano encima.', 'Đặt gốc bàn tay vào giữa ngực, đặt tay kia lên trên.', '将手掌根部放在胸部正中，另一只手叠放在上面。', 'Ilagay ang palad sa gitna ng dibdib at ipatong ang kabilang kamay.', 'हथेली का निचला भाग छाती के बीच में रखें और दूसरा हाथ उसके ऊपर रखें।'),
      S('Push hard and fast, at least 2 inches deep, about 2 times per second. Follow the beat.', 'Presione fuerte y rápido, al menos 5 centímetros de profundidad, unas 2 veces por segundo. Siga el ritmo.', 'Ấn mạnh và nhanh, sâu ít nhất 5 cm, khoảng 2 lần mỗi giây. Làm theo nhịp.', '用力快速按压，深度至少5厘米，每秒约2次。跟着节拍按压。', 'Pindutin nang malakas at mabilis, hindi bababa sa 2 pulgada ang lalim, mga 2 beses bawat segundo. Sundan ang tunog.', 'ज़ोर से और तेज़ दबाएँ, कम से कम 5 सेमी गहराई तक, लगभग हर सेकंड 2 बार। धुन के साथ चलें।'),
      S('Do not stop. Let the chest come back up fully each time. Keep going until help arrives or the person moves.', 'No se detenga. Deje que el pecho suba por completo cada vez. Continúe hasta que llegue la ayuda o la persona se mueva.', 'Đừng dừng lại. Để ngực nảy lên hoàn toàn sau mỗi lần ấn. Tiếp tục cho đến khi có người đến giúp hoặc người bệnh cử động.', '不要停止。每次按压后让胸部完全回弹。持续按压直到救援到达或患者有反应。', 'Huwag huminto. Hayaang ganap na bumalik ang dibdib sa bawat pagpindot. Magpatuloy hanggang dumating ang tulong o gumalaw ang tao.', 'रुकें नहीं। हर बार छाती को पूरी तरह ऊपर आने दें। मदद आने तक या व्यक्ति के हिलने तक जारी रखें।'),
    ],
  },
  {
    id: 'breathing', title: 'Breathing problems', icon: '🫁', color: '#ff3b47',
    questions: ['Is it you, or someone else?', 'Are they choking on something?', 'Can they speak in full sentences?', 'Do they have asthma or an inhaler?', 'Any swelling of the face, lips or throat?', 'Are their lips blue or gray?'],
    steps: [
      S('Sit upright, leaning slightly forward. Do not lie down.', 'Siéntese derecho, inclinado un poco hacia adelante. No se acueste.', 'Ngồi thẳng, hơi nghiêng người về phía trước. Không nằm xuống.', '坐直，身体稍微前倾。不要躺下。', 'Umupo nang tuwid at bahagyang nakayuko pasulong. Huwag humiga.', 'सीधे बैठें, थोड़ा आगे की ओर झुककर। लेटें नहीं।'),
      S('Loosen tight clothing. Open a window for fresh air.', 'Afloje la ropa apretada. Abra una ventana para que entre aire fresco.', 'Nới lỏng quần áo chật. Mở cửa sổ cho thoáng khí.', '解开过紧的衣物。打开窗户让新鲜空气进来。', 'Luwagan ang masikip na damit. Buksan ang bintana para sa sariwang hangin.', 'तंग कपड़े ढीले करें। ताज़ी हवा के लिए खिड़की खोलें।'),
      S('If you have a prescribed inhaler or EpiPen, use it now as directed.', 'Si tiene un inhalador o un EpiPen recetado, úselo ahora según las indicaciones.', 'Nếu có bình xịt hen hoặc bút tiêm EpiPen được kê đơn, hãy dùng ngay theo hướng dẫn.', '如果有医生开的吸入器或肾上腺素笔（EpiPen），请按说明立即使用。', 'Kung may niresetang inhaler o EpiPen, gamitin ito ngayon ayon sa tagubilin.', 'अगर डॉक्टर का दिया इनहेलर या EpiPen है, तो निर्देश के अनुसार अभी उसका उपयोग करें।'),
      S('Unlock the front door if you can, then stay still and stay on the line.', 'Si puede, abra la puerta principal. Luego quédese quieto y no cuelgue.', 'Nếu có thể, hãy mở khóa cửa trước, sau đó ngồi yên và đừng cúp máy.', '如果可以，先把前门打开，然后保持不动，不要挂断电话。', 'Kung kaya, i-unlock ang pinto sa harap, pagkatapos ay manatiling nakaupo at huwag ibaba ang telepono.', 'हो सके तो सामने का दरवाज़ा खोल दें, फिर शांत बैठे रहें और फ़ोन न काटें।'),
      S('If the person stops breathing or will not wake up, tell me right away. We will start CPR.', 'Si la persona deja de respirar o no despierta, dígamelo de inmediato. Empezaremos RCP.', 'Nếu người đó ngừng thở hoặc không tỉnh lại, báo cho tôi ngay. Chúng ta sẽ bắt đầu ép tim.', '如果患者停止呼吸或叫不醒，请立即告诉我。我们将开始心肺复苏。', 'Kung tumigil sa paghinga o hindi magising ang tao, sabihin agad sa akin. Sisimulan natin ang CPR.', 'अगर व्यक्ति साँस लेना बंद कर दे या जाग न सके, तो मुझे तुरंत बताएँ। हम CPR शुरू करेंगे।'),
    ],
  },
  {
    id: 'choking', title: 'Choking', icon: '😮‍💨', color: '#ff7a3d',
    questions: ['Can they speak or cough?', 'Adult, child, or infant?'],
    steps: [
      S('Ask: are you choking? If they cannot speak or cough, act now.', 'Pregunte: ¿se está ahogando? Si no puede hablar ni toser, actúe ya.', 'Hỏi: bạn có bị nghẹn không? Nếu không nói hay ho được, hãy hành động ngay.', '询问：您是不是噎住了？如果无法说话或咳嗽，请立即施救。', 'Itanong: nabubulunan ka ba? Kung hindi makapagsalita o makaubo, kumilos agad.', 'पूछें: क्या आपका दम घुट रहा है? अगर वे बोल या खाँस नहीं सकते, तो तुरंत कार्रवाई करें।'),
      S('Stand behind them. Give 5 hard back blows between the shoulder blades.', 'Párese detrás de la persona. Dé 5 golpes fuertes en la espalda, entre los omóplatos.', 'Đứng sau lưng họ. Vỗ mạnh 5 cái vào giữa hai bả vai.', '站在其身后，用力拍击两肩胛骨之间5下。', 'Tumayo sa likod nila. Bigyan ng 5 malakas na tapik sa likod, sa pagitan ng mga balikat.', 'उनके पीछे खड़े हों। कंधों के बीच पीठ पर 5 ज़ोरदार थपकी दें।'),
      S('Then wrap your arms around their waist. Make a fist above the belly button and pull hard inward and upward 5 times.', 'Luego rodee su cintura con los brazos. Haga un puño sobre el ombligo y jale con fuerza hacia adentro y hacia arriba 5 veces.', 'Sau đó vòng tay quanh bụng. Nắm tay đặt trên rốn và ấn mạnh vào trong, hướng lên trên 5 lần.', '然后双臂环抱其腰部，握拳置于肚脐上方，向内向上用力冲击5次。', 'Pagkatapos ay yakapin sila sa baywang. Ikuyom ang kamao sa itaas ng pusod at hilahin nang malakas papasok at pataas nang 5 beses.', 'फिर उनकी कमर के चारों ओर बाँहें डालें। नाभि के ऊपर मुट्ठी बनाकर ज़ोर से अंदर और ऊपर की ओर 5 बार दबाएँ।'),
      S('Repeat until the object comes out. If they stop responding, tell me right away.', 'Repita hasta que salga el objeto. Si deja de responder, avíseme de inmediato.', 'Lặp lại cho đến khi vật bị văng ra. Nếu họ không phản ứng, báo cho tôi ngay.', '重复上述动作直到异物排出。如果患者失去反应，请立即告诉我。', 'Ulitin hanggang lumabas ang bagay. Kung hindi na sila tumutugon, sabihin agad sa akin.', 'वस्तु बाहर निकलने तक दोहराएँ। अगर वे प्रतिक्रिया देना बंद कर दें, तो मुझे तुरंत बताएँ।'),
    ],
  },
  {
    id: 'childbirth', title: 'Childbirth', icon: '👶', color: '#c46bff',
    questions: ['How far apart are the contractions?', 'Is the baby\'s head visible?', 'Is this a first baby? How many weeks?'],
    steps: [
      S('Stay calm. Help the mother lie back or sit semi-reclined with knees bent. Do not let her use the toilet.', 'Mantenga la calma. Ayude a la madre a recostarse o sentarse semirreclinada con las rodillas dobladas. No la deje usar el baño.', 'Hãy bình tĩnh. Giúp sản phụ nằm hoặc ngồi nửa nằm, co đầu gối. Đừng để cô ấy đi vệ sinh.', '保持冷静。扶产妇半躺或半坐，屈膝。不要让她去厕所。', 'Manatiling kalmado. Tulungan ang ina na humiga o umupo nang bahagyang nakahilig, nakabaluktot ang tuhod. Huwag siyang payagang gumamit ng banyo.', 'शांत रहें। माँ को पीठ के बल या आधा लेटकर, घुटने मोड़कर बैठने में मदद करें। उन्हें शौचालय न जाने दें।'),
      S('Wash your hands if you can. Put clean towels under her. Do not pull on the baby.', 'Lávese las manos si puede. Ponga toallas limpias debajo de ella. No jale al bebé.', 'Rửa tay nếu có thể. Lót khăn sạch dưới người cô ấy. Không được kéo em bé.', '如果可以，请洗手。在她身下垫干净的毛巾。不要拉拽婴儿。', 'Maghugas ng kamay kung maaari. Maglagay ng malinis na tuwalya sa ilalim niya. Huwag hilahin ang sanggol.', 'यदि संभव हो तो हाथ धोएँ। उनके नीचे साफ़ तौलिए रखें। बच्चे को खींचें नहीं।'),
      S('When the head comes out, support it gently. If the cord is around the neck, slip it over the head. Do not pull.', 'Cuando salga la cabeza, sosténgala con suavidad. Si el cordón está alrededor del cuello, páselo por encima de la cabeza. No jale.', 'Khi đầu bé ra, nhẹ nhàng đỡ lấy. Nếu dây rốn quấn cổ, nhẹ nhàng gỡ qua đầu. Đừng kéo.', '胎头娩出时轻轻托住。如果脐带绕颈，轻轻从头部褪下。不要拉扯。', 'Kapag lumabas ang ulo, dahan-dahang alalayan. Kung nakapulupot ang pusod sa leeg, dahan-dahang ilusot sa ulo. Huwag hilahin.', 'जब सिर बाहर आए, उसे धीरे से सहारा दें। अगर नाल गर्दन के चारों ओर हो, तो उसे सिर के ऊपर से निकालें। खींचें नहीं।'),
      S('After the baby is out, dry the baby, wrap in a towel, and place on the mother\'s chest, skin to skin. Keep both warm.', 'Cuando nazca, seque al bebé, envuélvalo en una toalla y colóquelo sobre el pecho de la madre, piel con piel. Mantenga a ambos abrigados.', 'Sau khi bé ra, lau khô bé, quấn khăn và đặt lên ngực mẹ, da kề da. Giữ ấm cho cả hai.', '婴儿娩出后，擦干身体，用毛巾包裹，放在母亲胸前肌肤相贴。保持母婴温暖。', 'Kapag lumabas na ang sanggol, patuyuin, balutin ng tuwalya, at ilagay sa dibdib ng ina, balat sa balat. Panatilihing mainit ang dalawa.', 'बच्चे के जन्म के बाद, उसे सुखाएँ, तौलिए में लपेटें और माँ की छाती पर त्वचा से त्वचा लगाकर रखें। दोनों को गर्म रखें।'),
    ],
  },
  {
    id: 'bleeding', title: 'Severe bleeding', icon: '🩸', color: '#ff3b47',
    questions: ['Where is the bleeding?', 'Is it spurting or steady?', 'Are they awake?'],
    steps: [
      S('Press hard directly on the wound with a clean cloth. Do not remove it.', 'Presione con fuerza directamente sobre la herida con un paño limpio. No lo quite.', 'Dùng vải sạch ấn mạnh trực tiếp lên vết thương. Không bỏ ra.', '用干净的布直接用力压住伤口，不要拿开。', 'Diinan nang mahigpit ang sugat gamit ang malinis na tela. Huwag tanggalin.', 'साफ़ कपड़े से घाव पर सीधे ज़ोर से दबाएँ। इसे हटाएँ नहीं।'),
      S('If blood soaks through, add more cloth on top and keep pressing.', 'Si la sangre empapa la tela, ponga más tela encima y siga presionando.', 'Nếu máu thấm qua, đặt thêm vải lên trên và tiếp tục ấn.', '如果血渗透了，在上面加更多布料，继续按压。', 'Kung lumampas ang dugo, magdagdag ng tela sa ibabaw at ituloy ang pagdiin.', 'यदि खून रिस जाए, तो ऊपर और कपड़ा रखें और दबाते रहें।'),
      S('If it is an arm or leg and bleeding will not stop, tie a tight band or belt 2 inches above the wound.', 'Si es un brazo o pierna y no deja de sangrar, ate una banda o cinturón bien apretado 5 centímetros por encima de la herida.', 'Nếu là tay hoặc chân và máu không cầm, buộc chặt dây hoặc thắt lưng cách vết thương 5 cm về phía trên.', '如果是手臂或腿部且血流不止，在伤口上方5厘米处用布带或皮带紧紧扎住。', 'Kung braso o binti at hindi tumitigil ang dugo, magtali ng mahigpit na tali o sinturon 2 pulgada sa itaas ng sugat.', 'यदि हाथ या पैर है और खून नहीं रुक रहा, तो घाव से 5 सेमी ऊपर कसकर पट्टी या बेल्ट बाँधें।'),
      S('Lay the person down, keep them warm, and keep talking to them until help arrives.', 'Acueste a la persona, manténgala abrigada y siga hablándole hasta que llegue la ayuda.', 'Cho người bị thương nằm xuống, giữ ấm và tiếp tục nói chuyện với họ cho đến khi có người đến.', '让伤者躺下，保暖，并持续与其交谈直到救援到达。', 'Ihiga ang tao, panatilihing mainit, at patuloy na kausapin hanggang dumating ang tulong.', 'व्यक्ति को लिटाएँ, गर्म रखें और मदद आने तक उनसे बात करते रहें।'),
    ],
  },
  {
    id: 'stroke', title: 'Stroke (F.A.S.T.)', icon: '🧠', color: '#ff9f1c',
    questions: ['When did symptoms start?', 'Any blood thinners?'],
    steps: [
      S('Ask them to smile. Does one side of the face droop?', 'Pídale que sonría. ¿Se cae un lado de la cara?', 'Bảo họ mỉm cười. Một bên mặt có bị xệ không?', '请他们微笑。脸的一侧是否下垂？', 'Hilingin na ngumiti. Lumulubog ba ang isang bahagi ng mukha?', 'उनसे मुस्कुराने को कहें। क्या चेहरे का एक हिस्सा लटक रहा है?'),
      S('Ask them to raise both arms. Does one arm drift down?', 'Pídale que levante ambos brazos. ¿Un brazo baja?', 'Bảo họ giơ cả hai tay. Một tay có bị rơi xuống không?', '请他们抬起双臂。是否有一只手臂下垂？', 'Hilingin na itaas ang dalawang braso. Bumababa ba ang isa?', 'उनसे दोनों हाथ उठाने को कहें। क्या एक हाथ नीचे आ रहा है?'),
      S('Ask them to repeat a simple sentence. Is the speech slurred? Note the time symptoms started.', 'Pídale que repita una frase sencilla. ¿Habla arrastrado? Anote la hora en que empezaron los síntomas.', 'Bảo họ lặp lại một câu đơn giản. Họ có nói ngọng không? Ghi lại giờ bắt đầu triệu chứng.', '请他们重复一句简单的话。是否口齿不清？记下症状开始的时间。', 'Ipaulit ang isang simpleng pangungusap. Malabo ba ang pagsasalita? Itala ang oras na nagsimula ang sintomas.', 'उनसे एक सरल वाक्य दोहराने को कहें। क्या बोलना अस्पष्ट है? लक्षण शुरू होने का समय नोट करें।'),
      S('Do not give food, drink, or medicine. Keep them lying down, comfortable, and stay with them.', 'No les dé comida, bebida ni medicinas. Manténgalos acostados y cómodos, y quédese con ellos.', 'Không cho ăn, uống hay dùng thuốc. Để họ nằm thoải mái và ở bên cạnh.', '不要给予食物、饮料或药物。让他们舒适地躺着，陪在身边。', 'Huwag magbigay ng pagkain, inumin, o gamot. Panatilihing nakahiga at komportable, at manatili sa tabi nila.', 'खाना, पीना या दवा न दें। उन्हें आराम से लिटाए रखें और उनके साथ रहें।'),
    ],
  },
  {
    id: 'overdose', title: 'Overdose / poisoning', icon: '💊', color: '#ff9f1c',
    questions: ['What was taken, how much, and when?', 'Is naloxone available?'],
    steps: [
      S('Check if they respond and are breathing. Shake their shoulders and shout their name.', 'Verifique si responde y respira. Sacuda sus hombros y grite su nombre.', 'Kiểm tra xem họ có phản ứng và thở không. Lay vai và gọi tên họ.', '检查是否有反应和呼吸。摇晃其肩膀并大声呼喊其名字。', 'Tingnan kung tumutugon at humihinga. Kalugin ang balikat at isigaw ang pangalan.', 'देखें कि वे जवाब दे रहे हैं और साँस ले रहे हैं या नहीं। कंधे हिलाएँ और नाम पुकारें।'),
      S('If you have naloxone (Narcan), give it now: spray in one nostril.', 'Si tiene naloxona (Narcan), aplíquela ahora: un rocío en una fosa nasal.', 'Nếu có naloxone (Narcan), hãy dùng ngay: xịt vào một lỗ mũi.', '如果有纳洛酮（Narcan），立即使用：向一侧鼻孔喷入。', 'Kung may naloxone (Narcan), ibigay na ngayon: i-spray sa isang butas ng ilong.', 'यदि नालोक्सोन (Narcan) है, तो अभी दें: एक नथुने में स्प्रे करें।'),
      S('If they are not breathing, start CPR. If they are breathing, roll them onto their side.', 'Si no respira, inicie RCP. Si respira, colóquelo de lado.', 'Nếu không thở, bắt đầu ép tim. Nếu còn thở, xoay họ nằm nghiêng.', '如果没有呼吸，开始心肺复苏。如果有呼吸，让其侧卧。', 'Kung hindi humihinga, simulan ang CPR. Kung humihinga, ihiga sila nang nakatagilid.', 'यदि साँस नहीं ले रहे, तो CPR शुरू करें। यदि साँस ले रहे हैं, तो उन्हें करवट से लिटाएँ।'),
      S('Stay with them. Do not let them eat or drink. Tell me if their breathing changes.', 'Quédese con la persona. No la deje comer ni beber. Avíseme si cambia su respiración.', 'Ở bên cạnh họ. Không cho ăn hoặc uống. Báo cho tôi nếu nhịp thở thay đổi.', '陪在他们身边。不要让他们吃喝。如果呼吸发生变化请告诉我。', 'Manatili sa tabi nila. Huwag silang pakainin o painumin. Sabihin sa akin kung magbago ang paghinga.', 'उनके साथ रहें। उन्हें खाने-पीने न दें। साँस में बदलाव हो तो मुझे बताएँ।'),
    ],
  },
  {
    id: 'seizure', title: 'Seizure', icon: '⚡', color: '#ff9f1c',
    questions: ['Is it still happening?', 'Has this happened before?', 'Did they hit their head?'],
    steps: [
      S('Do not hold them down. Clear hard or sharp objects away.', 'No los sujete. Retire objetos duros o filosos.', 'Đừng giữ chặt họ. Dọn các vật cứng hoặc sắc nhọn ra xa.', '不要按住他们。移开坚硬或尖锐的物体。', 'Huwag silang hawakan nang mahigpit. Ilayo ang matitigas o matatalas na bagay.', 'उन्हें पकड़कर न रखें। कठोर या नुकीली चीज़ें दूर करें।'),
      S('Put something soft under their head. Do not put anything in their mouth.', 'Ponga algo suave bajo su cabeza. No ponga nada en su boca.', 'Đặt vật mềm dưới đầu. Không cho gì vào miệng.', '在头下垫柔软的东西。不要往嘴里放任何东西。', 'Maglagay ng malambot sa ilalim ng ulo. Huwag maglagay ng anuman sa bibig.', 'सिर के नीचे कोई नरम चीज़ रखें। मुँह में कुछ न डालें।'),
      S('Note the time. When shaking stops, roll them gently onto their side.', 'Anote la hora. Cuando paren las convulsiones, gírelos con suavidad hacia un lado.', 'Ghi lại thời gian. Khi hết co giật, nhẹ nhàng xoay họ nằm nghiêng.', '记录时间。抽搐停止后，轻轻让其侧卧。', 'Itala ang oras. Kapag tumigil ang panginginig, dahan-dahang ihiga sila nang nakatagilid.', 'समय नोट करें। झटके रुकने पर उन्हें धीरे से करवट से लिटाएँ।'),
      S('Stay with them until they are fully awake. Tell me if it lasts more than 5 minutes or happens again.', 'Quédese hasta que estén completamente despiertos. Avíseme si dura más de 5 minutos o vuelve a ocurrir.', 'Ở bên cho đến khi họ tỉnh hẳn. Báo cho tôi nếu kéo dài hơn 5 phút hoặc tái phát.', '陪伴直到其完全清醒。如果持续超过5分钟或再次发作请告诉我。', 'Manatili hanggang sila ay ganap na gising. Sabihin sa akin kung lumampas ng 5 minuto o maulit.', 'पूरी तरह होश में आने तक साथ रहें। अगर यह 5 मिनट से ज़्यादा चले या दोबारा हो तो मुझे बताएँ।'),
    ],
  },
  {
    id: 'burns', title: 'Burns', icon: '🔥', color: '#ff7a3d',
    questions: ['What caused the burn?', 'How large is the burned area?'],
    steps: [
      S('Move away from the heat source. Remove burning or hot clothing unless stuck to skin.', 'Aléjese de la fuente de calor. Quite la ropa caliente o en llamas, a menos que esté pegada a la piel.', 'Tránh xa nguồn nhiệt. Cởi bỏ quần áo đang cháy hoặc nóng, trừ khi dính vào da.', '远离热源。脱掉着火或发烫的衣物，除非粘在皮肤上。', 'Lumayo sa pinagmumulan ng init. Hubarin ang nasusunog o mainit na damit maliban kung dumikit sa balat.', 'गर्मी के स्रोत से दूर हटें। जलते या गर्म कपड़े उतारें, जब तक वे त्वचा से चिपके न हों।'),
      S('Cool the burn with cool running water for at least 10 minutes. No ice, butter, or ointment.', 'Enfríe la quemadura con agua fría corriente durante al menos 10 minutos. Sin hielo, mantequilla ni pomadas.', 'Làm mát vết bỏng dưới vòi nước mát chảy ít nhất 10 phút. Không dùng đá, bơ hay thuốc mỡ.', '用流动的凉水冲洗烧伤处至少10分钟。不要用冰、黄油或药膏。', 'Palamigin ang paso sa umaagos na malamig na tubig nang hindi bababa sa 10 minuto. Walang yelo, mantikilya, o pamahid.', 'जले हुए हिस्से को कम से कम 10 मिनट बहते ठंडे पानी से ठंडा करें। बर्फ़, मक्खन या मरहम न लगाएँ।'),
      S('Cover loosely with a clean, dry cloth. Do not pop blisters.', 'Cubra sin apretar con un paño limpio y seco. No reviente las ampollas.', 'Che nhẹ bằng vải sạch, khô. Không chọc vỡ bọng nước.', '用干净干燥的布松松盖住。不要弄破水泡。', 'Takpan nang maluwag ng malinis at tuyong tela. Huwag pumutin ang paltos.', 'साफ़, सूखे कपड़े से ढीला ढकें। छाले न फोड़ें।'),
    ],
  },
  {
    id: 'structure_fire', title: 'Structure fire', icon: '🏠', color: '#ff3b47',
    questions: ['Is everyone out of the building?', 'Is anyone trapped? Which floor?', 'Any hazards: propane, oxygen, chemicals?'],
    steps: [
      S('Get everyone out now. Do not stop for belongings.', 'Saquen a todos ahora. No se detenga por pertenencias.', 'Đưa mọi người ra ngoài ngay. Đừng dừng lại lấy đồ đạc.', '立即带所有人离开。不要为拿物品停留。', 'Palabasin ang lahat ngayon. Huwag huminto para sa mga gamit.', 'सभी को अभी बाहर निकालें। सामान के लिए न रुकें।'),
      S('Stay low under the smoke. Feel doors with the back of your hand. Do not open a hot door.', 'Manténgase agachado bajo el humo. Toque las puertas con el dorso de la mano. No abra una puerta caliente.', 'Cúi thấp dưới làn khói. Dùng mu bàn tay thử cửa. Không mở cửa nếu nóng.', '在烟雾下方保持低姿。用手背试探门。热门不要打开。', 'Dumapa sa ilalim ng usok. Hawakan ang pinto gamit ang likod ng kamay. Huwag buksan ang mainit na pinto.', 'धुएँ के नीचे झुककर रहें। हाथ के पिछले हिस्से से दरवाज़ा छूकर देखें। गर्म दरवाज़ा न खोलें।'),
      S('If you are trapped, close the door, seal the gaps with wet cloth, go to a window, and signal for help.', 'Si está atrapado, cierre la puerta, selle las rendijas con tela mojada, vaya a una ventana y pida ayuda.', 'Nếu bị mắc kẹt, đóng cửa, bịt khe hở bằng khăn ướt, ra cửa sổ và ra hiệu cầu cứu.', '如果被困，关上门，用湿布堵住缝隙，走到窗边并发出求救信号。', 'Kung naipit, isara ang pinto, takpan ang mga puwang ng basang tela, pumunta sa bintana at humingi ng tulong.', 'यदि फँस गए हैं, तो दरवाज़ा बंद करें, दरारों को गीले कपड़े से बंद करें, खिड़की पर जाएँ और मदद का इशारा करें।'),
      S('Once outside, stay outside. Meet at a safe spot away from the building so crews can find you.', 'Una vez afuera, no regrese. Reúnanse en un lugar seguro lejos del edificio para que los equipos los encuentren.', 'Khi đã ra ngoài, không quay lại. Tập trung ở nơi an toàn cách xa tòa nhà để lực lượng cứu hộ tìm thấy.', '到外面后不要返回。在远离建筑物的安全地点集合，以便救援人员找到你们。', 'Kapag nasa labas na, huwag nang bumalik. Magtipon sa ligtas na lugar na malayo sa gusali para makita kayo ng mga rescuer.', 'बाहर आने के बाद वापस न जाएँ। इमारत से दूर सुरक्षित जगह पर इकट्ठा हों ताकि दल आपको ढूँढ सकें।'),
    ],
  },
  {
    id: 'wildfire_evac', title: 'Wildfire / evacuation', icon: '🌲', color: '#ff7a3d',
    questions: ['Is the fire visible? Which direction?', 'Can everyone walk?', 'Any animals or livestock?'],
    steps: [
      S('Leave now if you are told to evacuate or you see flames or heavy smoke. Do not wait.', 'Salga ahora si le ordenan evacuar o ve llamas o humo denso. No espere.', 'Hãy rời đi ngay nếu được lệnh sơ tán hoặc thấy lửa hay khói dày. Đừng chần chừ.', '如果接到撤离指令，或看到火焰或浓烟，请立即离开，不要等待。', 'Umalis na ngayon kung inutusang lumikas o nakakita ng apoy o makapal na usok. Huwag maghintay.', 'यदि निकासी का आदेश है या आग या घना धुआँ दिखे, तो अभी निकल जाएँ। इंतज़ार न करें।'),
      S('Take people, pets, medicine, and IDs only. Close windows and doors but leave them unlocked.', 'Lleve solo personas, mascotas, medicinas y documentos. Cierre ventanas y puertas sin ponerles llave.', 'Chỉ mang theo người, thú cưng, thuốc và giấy tờ. Đóng cửa sổ và cửa ra vào nhưng không khóa.', '只带上人员、宠物、药品和证件。关好门窗但不要上锁。', 'Dalhin lamang ang mga tao, alagang hayop, gamot, at ID. Isara ang mga bintana at pinto ngunit huwag i-lock.', 'केवल लोग, पालतू जानवर, दवाइयाँ और पहचान पत्र लें। खिड़कियाँ और दरवाज़े बंद करें लेकिन ताला न लगाएँ।'),
      S('Drive with headlights on. Follow the official evacuation route. Do not drive toward the smoke.', 'Conduzca con las luces encendidas. Siga la ruta oficial de evacuación. No maneje hacia el humo.', 'Lái xe bật đèn pha. Đi theo tuyến sơ tán chính thức. Không lái về phía khói.', '开着车灯驾驶。沿官方撤离路线行驶。不要朝烟雾方向行驶。', 'Magmaneho nang bukas ang headlight. Sundan ang opisyal na ruta ng paglikas. Huwag magmaneho patungo sa usok.', 'हेडलाइट जलाकर चलें। आधिकारिक निकासी मार्ग का पालन करें। धुएँ की ओर गाड़ी न चलाएँ।'),
      S('If you cannot leave, tell me now. Tell me if anyone cannot walk or needs help.', 'Si no puede salir, dígamelo ahora. Dígame si alguien no puede caminar o necesita ayuda.', 'Nếu không thể rời đi, hãy báo ngay. Cho tôi biết nếu ai đó không thể đi hoặc cần giúp đỡ.', '如果无法离开，请立即告诉我。如果有人不能行走或需要帮助也请告诉我。', 'Kung hindi kayo makaalis, sabihin agad sa akin. Sabihin kung may hindi makalakad o nangangailangan ng tulong.', 'यदि आप नहीं निकल सकते, तो मुझे अभी बताएँ। यदि कोई चल नहीं सकता या उसे मदद चाहिए तो बताएँ।'),
    ],
  },
  {
    id: 'earthquake', title: 'Earthquake', icon: '🌐', color: '#ff9f1c',
    questions: ['Is anyone trapped?', 'Gas smell, fire, or water leaking?'],
    steps: [
      S('If shaking continues: drop, cover, and hold on under a sturdy table. Stay away from windows.', 'Si sigue temblando: agáchese, cúbrase y sujétese bajo una mesa resistente. Aléjese de las ventanas.', 'Nếu còn rung lắc: cúi xuống, nép dưới bàn chắc chắn và bám chặt. Tránh xa cửa sổ.', '如果仍在晃动：蹲下、掩护、抓牢，躲在坚固的桌子下。远离窗户。', 'Kung patuloy ang pagyanig: yumuko, magtakip, at kumapit sa ilalim ng matibay na mesa. Lumayo sa mga bintana.', 'यदि झटके जारी हैं: झुकें, ढकें और मज़बूत मेज़ के नीचे पकड़कर रहें। खिड़कियों से दूर रहें।'),
      S('When it stops, check for injuries. Do not use elevators. Expect aftershocks.', 'Cuando pare, revise si hay heridos. No use ascensores. Espere réplicas.', 'Khi hết rung, kiểm tra người bị thương. Không dùng thang máy. Chuẩn bị cho dư chấn.', '停止后检查有无受伤。不要乘电梯。预计会有余震。', 'Kapag tumigil, tingnan kung may nasaktan. Huwag gumamit ng elevator. Asahan ang aftershock.', 'झटके रुकने पर चोटों की जाँच करें। लिफ्ट का उपयोग न करें। झटके दोबारा आ सकते हैं।'),
      S('If you smell gas, leave the building and do not use switches or flames.', 'Si huele a gas, salga del edificio y no use interruptores ni llamas.', 'Nếu ngửi thấy gas, rời khỏi tòa nhà và không dùng công tắc hay lửa.', '如果闻到燃气味，离开建筑物，不要使用开关或明火。', 'Kung may amoy gas, lumabas ng gusali at huwag gumamit ng switch o apoy.', 'यदि गैस की गंध आए, तो इमारत से बाहर निकलें और स्विच या आग का उपयोग न करें।'),
      S('If someone is trapped, do not move heavy debris. Tell me where they are and keep talking to them.', 'Si alguien está atrapado, no mueva escombros pesados. Dígame dónde está y siga hablándole.', 'Nếu có người bị kẹt, đừng di chuyển đống đổ nát nặng. Cho tôi biết họ ở đâu và tiếp tục nói chuyện với họ.', '如果有人被困，不要搬动沉重的瓦砾。告诉我他们的位置，并持续与其交谈。', 'Kung may naipit, huwag galawin ang mabibigat na durog. Sabihin kung nasaan sila at patuloy silang kausapin.', 'यदि कोई फँसा है, तो भारी मलबा न हटाएँ। मुझे बताएँ वे कहाँ हैं और उनसे बात करते रहें।'),
    ],
  },
  {
    id: 'gas_leak', title: 'Gas leak', icon: '💨', color: '#ff9f1c',
    questions: ['Can you smell gas inside or outside?', 'Is anyone feeling sick or dizzy?'],
    steps: [
      S('Leave the building now. Do not use light switches, phones inside, or anything that can spark.', 'Salga del edificio ahora. No use interruptores, ni teléfonos adentro, ni nada que pueda hacer chispa.', 'Rời khỏi tòa nhà ngay. Không bật công tắc đèn, không dùng điện thoại bên trong hay bất cứ thứ gì có thể phát tia lửa.', '立即离开建筑物。不要使用电灯开关、室内电话或任何可能产生火花的东西。', 'Lumabas ng gusali ngayon. Huwag gumamit ng switch ng ilaw, telepono sa loob, o anumang makakalikha ng kislap.', 'अभी इमारत से बाहर निकलें। लाइट स्विच, अंदर फ़ोन या चिंगारी पैदा करने वाली किसी भी चीज़ का उपयोग न करें।'),
      S('Move upwind, at least 100 feet away. Keep others away.', 'Aléjese en dirección contraria al viento, al menos 30 metros. Mantenga a los demás lejos.', 'Di chuyển ngược chiều gió, cách ít nhất 30 mét. Giữ mọi người tránh xa.', '移动到上风处，至少距离30米。让其他人远离。', 'Lumipat sa direksyon na sinasalubong ang hangin, hindi bababa sa 100 talampakan ang layo. Ilayo ang iba.', 'हवा की दिशा के विपरीत, कम से कम 30 मीटर दूर जाएँ। दूसरों को दूर रखें।'),
      S('Do not go back inside. Wait for the gas company and fire crews.', 'No regrese al interior. Espere a la compañía de gas y a los bomberos.', 'Không quay lại bên trong. Chờ công ty gas và lực lượng cứu hỏa.', '不要返回室内。等待燃气公司和消防人员。', 'Huwag nang bumalik sa loob. Hintayin ang kompanya ng gas at mga bumbero.', 'वापस अंदर न जाएँ। गैस कंपनी और दमकल दल का इंतज़ार करें।'),
    ],
  },
  {
    id: 'vehicle_crash', title: 'Vehicle crash', icon: '🚗', color: '#ff9f1c',
    questions: ['How many vehicles?', 'Anyone injured or trapped?', 'Fuel leaking or fire?'],
    steps: [
      S('If you are in a safe place, stay out of traffic. Turn off engines and do not smoke.', 'Si está en un lugar seguro, manténgase fuera del tráfico. Apague los motores y no fume.', 'Nếu ở nơi an toàn, tránh xa làn xe. Tắt động cơ và không hút thuốc.', '如果处于安全位置，请远离车流。关闭发动机，不要吸烟。', 'Kung ligtas ang kinalalagyan, lumayo sa trapiko. Patayin ang makina at huwag manigarilyo.', 'यदि आप सुरक्षित जगह पर हैं, तो ट्रैफ़िक से दूर रहें। इंजन बंद करें और धूम्रपान न करें।'),
      S('Do not move injured people unless there is fire or immediate danger.', 'No mueva a los heridos a menos que haya fuego o peligro inmediato.', 'Không di chuyển người bị thương trừ khi có cháy hoặc nguy hiểm tức thì.', '除非有火灾或紧迫危险，否则不要移动伤者。', 'Huwag galawin ang mga nasugatan maliban kung may apoy o agarang panganib.', 'घायलों को तब तक न हिलाएँ जब तक आग या तत्काल खतरा न हो।'),
      S('Press a clean cloth on any bleeding. Tell me how many people are hurt.', 'Presione un paño limpio sobre cualquier sangrado. Dígame cuántas personas están heridas.', 'Dùng vải sạch ấn lên chỗ chảy máu. Cho tôi biết có bao nhiêu người bị thương.', '用干净的布按压出血处。告诉我有几人受伤。', 'Diinan ng malinis na tela ang anumang dumudugo. Sabihin kung ilan ang nasugatan.', 'खून बहने वाली जगह पर साफ़ कपड़ा दबाएँ। मुझे बताएँ कितने लोग घायल हैं।'),
    ],
  },
];

export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));

export function cardForLang(cardId, lang) {
  const c = CARD_BY_ID[cardId];
  if (!c) return null;
  return {
    id: c.id, title: c.title, icon: c.icon, metronome: c.metronome || null,
    steps: c.steps.map((s) => s[lang] || s.en),
    stepsEn: c.steps.map((s) => s.en),
  };
}
