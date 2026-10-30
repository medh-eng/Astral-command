/* VYUHA — Sanjaya, the narrator
 * In the epic, Sanjaya was given divine sight so he could tell the blind king
 * everything that happened on the battlefield. Here he tells you.
 *
 * Every line has an id. If a recorded voice file exists at
 *   assets/audio/voice/hi/<id>.mp3   (Hindi voice — used with Hinglish or Hindi text)
 *   assets/audio/voice/en/<id>.mp3   (English voice — used with English text)
 * it plays; otherwise the line is shown as text only. The full script, ready
 * for Sarvam AI's text-to-speech, is generated from this table into
 * docs/voice/sanjaya-lines.csv by tools/voice-script.mjs.
 *
 * Lines never name a deity, never mock anyone, and stay short enough to read
 * in one glance on a phone.
 */
(function (root) {
  'use strict';
  const AC = (root.AC = root.AC || {});

  /* id · English · Hinglish (Latin script, for on-screen text) · Hindi (Devanagari, for the voice) */
  const LINES = {
    start_duel: [
      ['start_duel_1', 'Maharaj, the armies face each other. Not one rank is known.', 'Maharaj, dono senayein aamne-saamne hain. Kisi ka rank pata nahi.', 'महाराज, दोनों सेनाएँ आमने-सामने हैं। किसी का रैंक पता नहीं।'],
      ['start_duel_2', 'The night is old, Maharaj. The war begins before dawn.', 'Raat dhal rahi hai, Maharaj. Yuddh subah se pehle shuru hota hai.', 'रात ढल रही है, महाराज। युद्ध सुबह से पहले शुरू होता है।']
    ],
    start_abhimanyu: [
      ['start_abhimanyu_1', 'Abhimanyu knew how to break in. Now we learn if you can break through.', 'Abhimanyu andar jaana jaanta tha. Ab dekhte hain aap todke dikhate hain ya nahi.', 'अभिमन्यु अंदर जाना जानता था। अब देखते हैं आप तोड़ के दिखाते हैं या नहीं।']
    ],
    start_daily: [
      ['start_daily_1', 'Today’s Chakravyuha is drawn, Maharaj. Everyone faces the same wheel.', 'Aaj ka Chakravyuha taiyaar hai, Maharaj. Sabke saamne wahi chakra hai.', 'आज का चक्रव्यूह तैयार है, महाराज। सबके सामने वही चक्र है।']
    ],
    start_tutorial: [
      ['start_tutorial_1', 'Guru Drona holds the enemy still. Learn the field, Maharaj.', 'Guru Drona dushman ko roke hue hain. Maidan samajh lijiye, Maharaj.', 'गुरु द्रोण दुश्मन को रोके हुए हैं। मैदान समझ लीजिए, महाराज।']
    ],
    win_capture: [
      ['win_capture_1', 'A clean blow, Maharaj. Their piece falls.', 'Kya vaar tha, Maharaj! Unka mohra gir gaya.', 'क्या वार था, महाराज! उनका मोहरा गिर गया।'],
      ['win_capture_2', 'Our line pushes forward.', 'Hamari pankti aage badh rahi hai.', 'हमारी पंक्ति आगे बढ़ रही है।']
    ],
    lose_capture: [
      ['lose_capture_1', 'We lost one, Maharaj. They were stronger than they looked.', 'Humne ek mohra kho diya, Maharaj. Woh dikhne se zyada taaqatwar the.', 'हमने एक मोहरा खो दिया, महाराज। वो दिखने से ज़्यादा ताक़तवर थे।'],
      ['lose_capture_2', 'Repelled. Now we know what stands there.', 'Rok diya gaya. Ab pata hai wahan kaun khada hai.', 'रोक दिया गया। अब पता है वहाँ कौन खड़ा है।']
    ],
    both_fell: [
      ['both_fell_1', 'Equal strength. Both warriors fall together.', 'Barabar ki takkar. Dono yoddha saath gire.', 'बराबर की टक्कर। दोनों योद्धा साथ गिरे।']
    ],
    trap_hit: [
      ['trap_hit_1', 'A Shataghni! The trap held, Maharaj.', 'Shataghni! Jaal ne pakad liya, Maharaj.', 'शतघ्नी! जाल ने पकड़ लिया, महाराज।']
    ],
    trap_defused: [
      ['trap_defused_1', 'The Yantrik takes the trap apart. The lane is open.', 'Yantrik ne jaal bekaar kar diya. Raasta saaf hai.', 'यंत्रिक ने जाल बेकार कर दिया। रास्ता साफ़ है।']
    ],
    assassinate: [
      ['assassinate_1', 'The Chara struck first — and a commander fell!', 'Chara ne pehla vaar kiya — aur ek senapati gir gaya!', 'चर ने पहला वार किया — और एक सेनापति गिर गया!']
    ],
    volley_kill: [
      ['volley_kill_1', 'A rain of arrows. The archer never moved.', 'Teeron ki barsaat. Dhanurdhar apni jagah se hila bhi nahi.', 'तीरों की बरसात। धनुर्धर अपनी जगह से हिला भी नहीं।']
    ],
    volley_turned: [
      ['volley_turned_1', 'The arrows broke on heavy armour.', 'Teer bhaari kavach se takra ke toot gaye.', 'तीर भारी कवच से टकरा के टूट गए।']
    ],
    scan: [
      ['scan_1', 'Divya-drishti. Nothing stays hidden from the seer.', 'Divya-drishti. Drashta se kuch nahi chhupta.', 'दिव्य-दृष्टि। द्रष्टा से कुछ नहीं छुपता।']
    ],
    breach_enemy: [
      ['breach_enemy_1', 'Their gate is broken! One more blow, Maharaj!', 'Unka dwaar toot gaya! Bas ek vaar aur, Maharaj!', 'उनका द्वार टूट गया! बस एक वार और, महाराज!']
    ],
    breach_own: [
      ['breach_own_1', 'Maharaj, our gate is broken! Defend the fort!', 'Maharaj, hamara dwaar toot gaya! Durg bachaiye!', 'महाराज, हमारा द्वार टूट गया! दुर्ग बचाइए!']
    ],
    fort_won: [
      ['fort_won_1', 'The fort is ours! Vijay, Maharaj!', 'Durg hamara hai! Vijay, Maharaj!', 'दुर्ग हमारा है! विजय, महाराज!']
    ],
    fort_lost: [
      ['fort_lost_1', 'Our fort has fallen, Maharaj.', 'Hamara durg gir gaya, Maharaj.', 'हमारा दुर्ग गिर गया, महाराज।']
    ],
    rotate: [
      ['rotate_1', 'The chakra turns! Everything on the inner rings is exposed.', 'Chakra ghoom gaya! Andar ke gheron par sab kuch dikh gaya.', 'चक्र घूम गया! अंदर के घेरों पर सब कुछ दिख गया।']
    ],
    rotate_padma: [
      ['rotate_padma_1', 'The lotus turns, Maharaj. Its petals give away their secrets.', 'Kamal ghoom gaya, Maharaj. Pankhudiyon ke raaz khul gaye.', 'कमल घूम गया, महाराज। पंखुड़ियों के राज़ खुल गए।']
    ],
    dawn: [
      ['dawn_1', 'Dawn. The hour of Surya — our blows land harder.', 'Subah ho gayi. Surya ka pehar — hamare vaar bhaari padenge.', 'सुबह हो गई। सूर्य का पहर — हमारे वार भारी पड़ेंगे।']
    ],
    dawn_enemy: [
      ['dawn_enemy_1', 'Dawn, and the sun is theirs. Hold the line.', 'Subah ho gayi, aur suraj unka hai. Pankti sambhaliye.', 'सुबह हो गई, और सूरज उनका है। पंक्ति संभालिए।']
    ],
    dusk: [
      ['dusk_1', 'Night falls. The hour of Chandra is ours.', 'Raat ho gayi. Chandra ka pehar hamara hai.', 'रात हो गई। चंद्र का पहर हमारा है।']
    ],
    dusk_enemy: [
      ['dusk_enemy_1', 'Night falls, Maharaj. The moon fights for them now.', 'Raat ho gayi, Maharaj. Ab chaand unki taraf se ladega.', 'रात हो गई, महाराज। अब चाँद उनकी तरफ़ से लड़ेगा।']
    ],
    makara: [
      ['makara_1', 'Makara — the jaws close!', 'Makara — jabde band ho gaye!', 'मकर — जबड़े बंद हो गए!']
    ],
    padma: [
      ['padma_1', 'Padma — the petals closed around it.', 'Padma — pankhudiyon ne use gher liya.', 'पद्म — पंखुड़ियों ने उसे घेर लिया।']
    ],
    shield_break: [
      ['shield_break_1', 'It won, but its shield is cracked.', 'Jeet gaya, par dhaal toot gayi.', 'जीत गया, पर ढाल टूट गई।']
    ],
    shakti_full: [
      ['shakti_full_1', 'Five lamps burn, Maharaj. The Brahmastra can be called.', 'Paanchon diye jal rahe hain, Maharaj. Brahmastra bulaya ja sakta hai.', 'पाँचों दिये जल रहे हैं, महाराज। ब्रह्मास्त्र बुलाया जा सकता है।']
    ],
    astra_vayavya: [
      ['astra_vayavya_1', 'Vayavyastra! A wind moves our pieces.', 'Vayavyastra! Hawa ne hamare mohre badal diye.', 'वायव्यास्त्र! हवा ने हमारे मोहरे बदल दिए।']
    ],
    astra_vayavya_enemy: [
      ['astra_vayavya_enemy_1', 'A wind on their side of the field. Two of their pieces have changed places.', 'Unki taraf hawa chali. Unke do mohre jagah badal chuke hain.', 'उनकी तरफ़ हवा चली। उनके दो मोहरे जगह बदल चुके हैं।']
    ],
    astra_sammohana: [
      ['astra_sammohana_1', 'Sammohanastra! Their warrior stands entranced.', 'Sammohanastra! Unka yoddha sammohit khada hai.', 'सम्मोहनास्त्र! उनका योद्धा सम्मोहित खड़ा है।']
    ],
    astra_sammohana_enemy: [
      ['astra_sammohana_enemy_1', 'One of ours is entranced, Maharaj. Two turns of stillness.', 'Hamara ek yoddha sammohit hai, Maharaj. Do chaal tak ruk gaya.', 'हमारा एक योद्धा सम्मोहित है, महाराज। दो चाल तक रुक गया।']
    ],
    astra_agneya: [
      ['astra_agneya_1', 'Agneyastra! Fire sweeps their line.', 'Agneyastra! Aag unki pankti par baras rahi hai.', 'आग्नेयास्त्र! आग उनकी पंक्ति पर बरस रही है।']
    ],
    astra_agneya_enemy: [
      ['astra_agneya_enemy_1', 'Fire on our side, Maharaj!', 'Hamari taraf aag, Maharaj!', 'हमारी तरफ़ आग, महाराज!']
    ],
    astra_brahma: [
      ['astra_brahma_1', 'Brahmastra! Nothing withstands it.', 'Brahmastra! Iske aage kuch nahi tikta.', 'ब्रह्मास्त्र! इसके आगे कुछ नहीं टिकता।']
    ],
    astra_brahma_enemy: [
      ['astra_brahma_enemy_1', 'They have loosed the Brahmastra, Maharaj!', 'Unhone Brahmastra chhod diya, Maharaj!', 'उन्होंने ब्रह्मास्त्र छोड़ दिया, महाराज!']
    ],
    entranced_pass: [
      ['entranced_pass_1', 'Every warrior who could move stands entranced. The turn passes.', 'Har chalne wala yoddha sammohit hai. Baari nikal gayi.', 'हर चलने वाला योद्धा सम्मोहित है। बारी निकल गई।']
    ],
    last_rounds: [
      ['last_rounds_1', 'Only a few rounds left, Maharaj. The wheel is closing.', 'Bas kuch hi chaal baaki hain, Maharaj. Chakra band ho raha hai.', 'बस कुछ ही चाल बाकी हैं, महाराज। चक्र बंद हो रहा है।']
    ],
    sunset_near: [
      ['sunset_near_1', 'The sun is low. At sunset, the stronger army holds the field.', 'Suraj dhal raha hai. Shaam ko jo senaa takatwar hogi, maidan uska.', 'सूरज ढल रहा है। शाम को जो सेना ताक़तवर होगी, मैदान उसका।']
    ],
    victory: [
      ['victory_1', 'Vijay! The field is yours, Maharaj.', 'Vijay! Maidan aapka hai, Maharaj.', 'विजय! मैदान आपका है, महाराज।']
    ],
    defeat: [
      ['defeat_1', 'The field is lost today, Maharaj. Tomorrow there is another dawn.', 'Aaj maidan haath se gaya, Maharaj. Kal phir subah hogi.', 'आज मैदान हाथ से गया, महाराज। कल फिर सुबह होगी।']
    ],
    draw: [
      ['draw_1', 'Neither army could break the other. The field is shared.', 'Koi bhi sena doosri ko tod nahi payi. Maidan baraabar.', 'कोई भी सेना दूसरी को तोड़ नहीं पाई। मैदान बराबर।']
    ]
  };

  const LANGS = ['hinglish', 'en', 'hi'];
  let lang = 'hinglish';
  let voiceOn = true;
  const voiceMissing = {};
  let playing = null;
  let lastAt = 0;

  function setLang(l) { if (LANGS.indexOf(l) !== -1) lang = l; }
  function setVoice(v) { voiceOn = !!v; }

  function pick(key) {
    const list = LINES[key];
    if (!list || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)];
  }

  function textOf(line, l) {
    const L = l || lang;
    return L === 'en' ? line[1] : L === 'hi' ? line[3] : line[2];
  }

  /* Recorded voice is optional: the first miss for a line remembers itself so
   * a game without voice files never asks twice. */
  function playVoice(line) {
    if (!voiceOn || typeof Audio === 'undefined') return;
    // one Hindi recording serves both the Hinglish and the Hindi text
    const vlang = lang === 'en' ? 'en' : 'hi';
    const url = 'assets/audio/voice/' + vlang + '/' + line[0] + '.mp3';
    if (voiceMissing[url]) return;
    const settings = AC.audio && AC.audio.getSettings ? AC.audio.getSettings() : {};
    if (settings.muted) return;
    try {
      if (playing) { playing.pause(); playing = null; }
      const el = new Audio(url);
      el.volume = Math.min(1, Math.max(0.1, (settings.sfx != null ? settings.sfx : 0.7) * 1.2));
      el.onerror = function () { voiceMissing[url] = true; };
      const p = el.play();
      if (p && p.catch) p.catch(function () { voiceMissing[url] = true; });
      playing = el;
      if (AC.audio && AC.audio.duck) AC.audio.duck(2200);
    } catch (e) { voiceMissing[url] = true; }
  }

  let onLine = null;

  /* Say something. `opts.force` skips the spacing that keeps Sanjaya from
   * talking over himself on busy turns. Returns the line (or null). */
  function say(key, opts) {
    opts = opts || {};
    const now = Date.now();
    if (!opts.force && now - lastAt < 900) return null;
    const line = pick(key);
    if (!line) return null;
    lastAt = now;
    if (onLine) onLine(textOf(line), line, key);
    if (opts.voice !== false) playVoice(line);
    return line;
  }

  function allLines() {
    const out = [];
    Object.keys(LINES).forEach(function (key) {
      LINES[key].forEach(function (l) { out.push({ key: key, id: l[0], en: l[1], hinglish: l[2], hi: l[3] }); });
    });
    return out;
  }

  AC.sanjaya = {
    LINES: LINES,
    LANGS: LANGS,
    say: say,
    setLang: setLang,
    setVoice: setVoice,
    textOf: textOf,
    lang: function () { return lang; },
    allLines: allLines,
    onLine: function (fn) { onLine = fn; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
