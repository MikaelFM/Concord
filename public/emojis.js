'use strict';
// Emojis padrão. Cada linha: emoji, atalho e palavras de busca (pt e en).
const EMOJI_DATA = [
  ['Pessoas', '😀', `
😀 sorrindo grinning feliz
😃 sorriso smiley feliz
😄 sorrisao smile feliz
😁 sorriso_dentes grin
😆 rindo laughing haha
😅 suando sweat_smile nervoso
🤣 rolando_de_rir rofl kkk
😂 chorando_de_rir joy kkk risada
🙂 sorriso_leve slight_smile
🙃 de_cabeca_pra_baixo upside_down
😉 piscando wink
😊 corado blush feliz
😇 anjo innocent
🥰 apaixonado smiling_hearts amor
😍 olhos_coracao heart_eyes amor
🤩 deslumbrado star_struck estrela
😘 beijo kissing_heart
😗 beijinho kissing
😋 delicia yum gostoso
😛 lingua tongue
😜 lingua_piscando stuck_out_tongue_winking_eye
🤪 doido zany louco
😝 lingua_olhos_fechados squinting_tongue
🤑 dinheiro money_mouth
🤗 abraco hugging
🤭 mao_na_boca hand_over_mouth ops
🤫 shh silencio shushing
🤔 pensando thinking hmm
🤐 boca_fechada zipper
🤨 desconfiado raised_eyebrow sobrancelha
😐 neutro neutral
😑 sem_expressao expressionless
😶 sem_boca no_mouth
😏 malicioso smirk
😒 entediado unamused
🙄 revirando_olhos rolling_eyes
😬 careta grimacing
😮‍💨 suspiro exhale
🤥 mentiroso lying
😌 aliviado relieved
😔 pensativo pensive triste
😪 sonolento sleepy
🤤 babando drooling
😴 dormindo sleeping zzz
😷 mascara mask doente
🤒 febre thermometer doente
🤕 machucado head_bandage
🤢 enjoado nauseated
🤮 vomitando vomiting
🥵 calor hot quente
🥶 frio cold gelado
🥴 tonto woozy bebado
😵 zonzo dizzy
🤯 cabeca_explodindo exploding_head chocado
🤠 cowboy chapeu
🥳 festa partying aniversario
😎 oculos sunglasses estiloso
🤓 nerd
🧐 monoculo monocle
😕 confuso confused
😟 preocupado worried
🙁 triste_leve slight_frown
☹️ triste frowning
😮 boca_aberta open_mouth
😯 surpreso hushed
😲 espantado astonished
😳 envergonhado flushed
🥺 suplicando pleading por_favor
🥹 segurando_lagrimas holding_back_tears
😦 franzindo frowning_open
😧 angustiado anguished
😨 assustado fearful medo
😰 ansioso anxious
😥 desapontado disappointed_relieved
😢 chorando cry triste
😭 chorando_muito sob
😱 gritando scream medo
😖 confundido confounded
😣 perseverante persevere
😞 decepcionado disappointed
😓 suor_frio sweat
😩 cansado weary
😫 exausto tired
🥱 bocejando yawning sono
😤 bufando triumph
😡 furioso rage raiva
😠 bravo angry raiva
🤬 xingando cursing palavrao
😈 diabinho smiling_imp
👿 diabo imp
💀 caveira skull morri
☠️ caveira_ossos skull_crossbones
💩 coco poop
🤡 palhaco clown
👹 ogro ogre
👻 fantasma ghost
👽 alien et
👾 invasor space_invader game
🤖 robo robot
😺 gato_sorrindo smiley_cat
😹 gato_rindo joy_cat
😻 gato_apaixonado heart_eyes_cat
🙈 macaco_olhos see_no_evil
🙉 macaco_ouvidos hear_no_evil
🙊 macaco_boca speak_no_evil
👋 tchau wave oi aceno
🤚 mao_levantada raised_back_of_hand
✋ mao hand pare
🖖 vulcano vulcan spock
👌 ok ok_hand perfeito
🤌 dedos_juntos pinched_fingers italiano
✌️ paz v victory
🤞 dedos_cruzados crossed_fingers sorte
🤟 te_amo love_you
🤘 rock metal
🤙 me_liga call_me hang_loose
👈 esquerda point_left
👉 direita point_right
👆 cima point_up
👇 baixo point_down
☝️ dedo_cima point_up_2
👍 joinha thumbsup like positivo
👎 deslike thumbsdown negativo
✊ punho fist
👊 soco punch
👏 palmas clap
🙌 maos_pro_alto raised_hands
🫶 coracao_maos heart_hands
👐 maos_abertas open_hands
🤝 aperto_de_mao handshake acordo
🙏 por_favor pray obrigado reza
✍️ escrevendo writing
💪 forca muscle biceps
🧠 cerebro brain
👀 olhos eyes olhando
👁️ olho eye
👅 lingua_fora tongue_out
👄 boca lips
💋 batom kiss
👶 bebe baby
🧒 crianca child
👦 menino boy
👧 menina girl
🧑 pessoa person
👨 homem man
👩 mulher woman
🧓 idoso older_person
👮 policial police
🕵️ detetive detective
👷 pedreiro construction_worker
🤴 principe prince
👸 princesa princess
🧙 mago mage
🧛 vampiro vampire
🧟 zumbi zombie
🦸 heroi superhero
🥷 ninja
🤷 sei_la shrug
🤦 facepalm vergonha
🙋 levantando_mao raising_hand
🙅 nao no_good
🙆 tudo_ok ok_woman
💁 atendente tipping_hand
🏃 correndo runner
💃 dancando dancer
🕺 danca_homem man_dancing
🧘 meditando lotus yoga
🛌 deitado sleeping_accommodation
👯 coelhinhas dancers
`],
  ['Corações', '❤️', `
❤️ coracao heart amor vermelho
🧡 coracao_laranja orange_heart
💛 coracao_amarelo yellow_heart
💚 coracao_verde green_heart
💙 coracao_azul blue_heart
💜 coracao_roxo purple_heart
🖤 coracao_preto black_heart
🤍 coracao_branco white_heart
🤎 coracao_marrom brown_heart
💔 coracao_partido broken_heart
❣️ exclamacao_coracao heart_exclamation
💕 dois_coracoes two_hearts
💞 coracoes_girando revolving_hearts
💓 coracao_batendo heartbeat
💗 coracao_crescendo heartpulse
💖 coracao_brilhante sparkling_heart
💘 cupido cupid flecha
💝 coracao_presente gift_heart
❤️‍🔥 coracao_em_chamas heart_on_fire
❤️‍🩹 coracao_curado mending_heart
💌 carta_de_amor love_letter
💯 cem 100 perfeito
💢 raiva_simbolo anger
💥 explosao boom
💫 tonteira dizzy_symbol
💦 gotas sweat_drops
💨 vento dash rapido
💬 balao speech_balloon
💭 pensamento thought_balloon
💤 zzz sono
`],
  ['Natureza', '🐶', `
🐶 cachorro dog
🐱 gato cat
🐭 rato mouse
🐹 hamster
🐰 coelho rabbit
🦊 raposa fox
🐻 urso bear
🐼 panda
🐨 coala koala
🐯 tigre tiger
🦁 leao lion
🐮 vaca cow
🐷 porco pig
🐸 sapo frog
🐵 macaco monkey
🐔 galinha chicken
🐧 pinguim penguin
🐦 passaro bird
🐤 pintinho chick
🦆 pato duck
🦅 aguia eagle
🦉 coruja owl
🦇 morcego bat
🐺 lobo wolf
🐗 javali boar
🐴 cavalo horse
🦄 unicornio unicorn
🐝 abelha bee
🐛 lagarta bug
🦋 borboleta butterfly
🐌 caracol snail
🐞 joaninha ladybug
🐜 formiga ant
🕷️ aranha spider
🐢 tartaruga turtle
🐍 cobra snake
🦎 lagarto lizard
🦖 dinossauro t_rex
🐙 polvo octopus
🦑 lula squid
🦀 caranguejo crab
🐠 peixe_tropical tropical_fish
🐟 peixe fish
🐬 golfinho dolphin
🐳 baleia whale
🦈 tubarao shark
🐊 jacare crocodile
🐘 elefante elephant
🦒 girafa giraffe
🦘 canguru kangaroo
🐕 cao dog2
🐈 gato2 cat2
🦜 papagaio parrot
🐿️ esquilo chipmunk
🌵 cacto cactus
🎄 arvore_de_natal christmas_tree
🌲 pinheiro evergreen
🌳 arvore tree
🌴 coqueiro palm_tree
🌱 broto seedling
🌿 erva herb
☘️ trevo shamrock
🍀 trevo_sorte four_leaf_clover
🍁 folha_bordo maple_leaf
🍂 folhas fallen_leaf outono
🍄 cogumelo mushroom
🌷 tulipa tulip
🌹 rosa rose flor
🌻 girassol sunflower
🌸 cerejeira cherry_blossom
💐 buque bouquet
🌎 terra earth mundo
🌙 lua moon
⭐ estrela star
🌟 estrela_brilhante star2
✨ brilho sparkles
⚡ raio zap
🔥 fogo fire
🌈 arco_iris rainbow
☀️ sol sunny
⛅ nublado partly_sunny
☁️ nuvem cloud
🌧️ chuva rain
⛈️ tempestade thunder
❄️ neve snowflake
☃️ boneco_de_neve snowman
🌊 onda wave_water mar
💧 gota droplet
`],
  ['Comida', '🍔', `
🍏 maca_verde green_apple
🍎 maca apple
🍐 pera pear
🍊 laranja tangerine
🍋 limao lemon
🍌 banana
🍉 melancia watermelon
🍇 uva grapes
🍓 morango strawberry
🍒 cereja cherries
🍑 pessego peach
🥭 manga mango
🍍 abacaxi pineapple
🥥 coco_fruta coconut
🥝 kiwi
🍅 tomate tomato
🍆 berinjela eggplant
🥑 abacate avocado
🥦 brocolis broccoli
🌽 milho corn
🥕 cenoura carrot
🌶️ pimenta hot_pepper
🧄 alho garlic
🧅 cebola onion
🥔 batata potato
🍞 pao bread
🥐 croissant
🧀 queijo cheese
🥚 ovo egg
🍳 frigideira cooking
🥓 bacon
🥩 carne cut_of_meat churrasco
🍗 frango poultry_leg coxinha
🍖 osso_carne meat_on_bone
🌭 cachorro_quente hotdog
🍔 hamburguer hamburger
🍟 batata_frita fries
🍕 pizza
🥪 sanduiche sandwich
🌮 taco
🌯 burrito
🥗 salada salad
🍝 macarrao spaghetti
🍜 lamen ramen
🍣 sushi
🍤 camarao fried_shrimp
🍙 onigiri rice_ball
🍚 arroz rice
🥟 pastel dumpling
🍦 sorvete_casquinha icecream
🍨 sorvete ice_cream
🍩 rosquinha doughnut
🍪 biscoito cookie
🎂 bolo_aniversario birthday
🍰 bolo cake
🧁 cupcake
🍫 chocolate
🍬 bala candy
🍭 pirulito lollipop
🍿 pipoca popcorn
🥤 refrigerante cup_with_straw
🧃 suco juice
☕ cafe coffee
🍵 cha tea
🧉 chimarrao mate
🍺 cerveja beer
🍻 brinde_cerveja beers
🥂 brinde champagne_glass
🍷 vinho wine
🥃 whisky tumbler
🍸 coquetel cocktail
🍹 drink tropical_drink
🧊 gelo ice
`],
  ['Atividades', '⚽', `
⚽ futebol soccer bola
🏀 basquete basketball
🏈 futebol_americano football
⚾ beisebol baseball
🎾 tenis tennis
🏐 volei volleyball
🏉 rugby
🎱 sinuca 8ball
🏓 ping_pong
🏸 badminton
🥊 boxe boxing
🥋 artes_marciais martial_arts
⛳ golfe golf
🛹 skate skateboard
🎿 esqui ski
🏆 trofeu trophy campeao
🥇 ouro first_place medalha
🥈 prata second_place
🥉 bronze third_place
🏅 medalha medal
🎖️ condecoracao military_medal
🎮 videogame video_game controle
🕹️ joystick
🎲 dado game_die
♟️ xadrez chess
🧩 quebra_cabeca puzzle
🎯 alvo dart
🎳 boliche bowling
🎰 caca_niquel slot_machine
🎨 arte art pintura
🎬 claquete clapper filme
🎤 microfone microphone karaoke
🎧 fone headphones musica
🎼 partitura musical_score
🎹 teclado_musical piano
🥁 bateria drum
🎸 guitarra guitar
🎻 violino violin
🎺 trompete trumpet
🎷 saxofone saxophone
🎵 nota musical_note
🎶 notas notes musica
🎉 festa_confete tada parabens
🎊 confete confetti_ball
🎈 balao_festa balloon
🎁 presente gift
🎃 abobora jack_o_lantern halloween
🎆 fogos fireworks
🎇 estrelinha sparkler
🎫 ingresso ticket
`],
  ['Viagens', '🚗', `
🚗 carro car
🚕 taxi
🚌 onibus bus
🚓 viatura police_car
🚑 ambulancia ambulance
🚒 bombeiros fire_engine
🏎️ corrida race_car
🏍️ moto motorcycle
🚲 bicicleta bike
🛴 patinete scooter
🚂 trem steam_locomotive
🚇 metro metro
✈️ aviao airplane
🚀 foguete rocket
🛸 disco_voador ufo
🚁 helicoptero helicopter
⛵ veleiro sailboat
🚢 navio ship
⚓ ancora anchor
🗺️ mapa map
🧭 bussola compass
🏔️ montanha_neve mountain_snow
🌋 vulcao volcano
🏖️ praia beach
🏝️ ilha island
🏕️ acampamento camping
🏠 casa house
🏡 casa_jardim house_with_garden
🏢 predio office
🏥 hospital
🏫 escola school
🏰 castelo castle
⛪ igreja church
🗽 estatua_liberdade statue_of_liberty
🗼 torre tokyo_tower
🎡 roda_gigante ferris_wheel
🎢 montanha_russa roller_coaster
🌃 noite night_with_stars
🌅 nascer_do_sol sunrise
🌇 por_do_sol city_sunset
🇧🇷 brasil br bandeira
🇵🇹 portugal pt
🇺🇸 eua us usa
🏁 bandeira_quadriculada checkered_flag
🚩 bandeira_vermelha red_flag
🏳️‍🌈 bandeira_arco_iris rainbow_flag
`],
  ['Objetos', '💡', `
⌚ relogio watch
📱 celular iphone
💻 notebook computer
⌨️ teclado keyboard
🖥️ monitor desktop
🖱️ mouse_pc computer_mouse
🖨️ impressora printer
💾 disquete floppy_disk
💿 cd
📷 camera
🎥 filmadora movie_camera
📺 tv television
📻 radio
🔋 bateria_carga battery
🔌 tomada plug
💡 lampada bulb ideia
🔦 lanterna flashlight
🕯️ vela candle
💸 dinheiro_voando money_with_wings
💵 dolar dollar
💰 saco_dinheiro moneybag
💳 cartao credit_card
💎 diamante gem
⚖️ balanca scales
🔧 chave_inglesa wrench
🔨 martelo hammer
⚒️ ferramentas hammer_and_pick
🛠️ ferramentas2 tools
⚙️ engrenagem gear
🔫 pistola_agua water_pistol
💣 bomba bomb
🔪 faca knife
🗡️ adaga dagger
⚔️ espadas crossed_swords
🛡️ escudo shield
🔮 bola_de_cristal crystal_ball
💊 remedio pill
💉 seringa syringe
🧬 dna
🔬 microscopio microscope
🔭 telescopio telescope
🧹 vassoura broom
🧻 papel_higienico roll_of_paper
🚽 privada toilet
🛁 banheira bathtub
🔑 chave key
🚪 porta door
🛋️ sofa couch
🛏️ cama bed
🧸 ursinho teddy_bear
🎀 laco ribbon
✉️ envelope email
📦 caixa package
📝 anotacao memo nota
📅 calendario calendar
📌 alfinete pushpin fixar
📎 clipe paperclip
✂️ tesoura scissors
🔒 cadeado lock
🔓 destrancado unlock
📚 livros books
📖 livro book
🔔 sino bell notificacao
🔕 sem_sino no_bell
📢 megafone loudspeaker
📣 megafone2 mega
⏰ despertador alarm_clock
⏳ ampulheta hourglass
`],
  ['Símbolos', '✅', `
✅ check white_check_mark feito certo
☑️ caixa_check ballot_box_with_check
✔️ visto heavy_check_mark
❌ x errado
❎ x_quadrado negative_squared_cross_mark
➕ mais plus
➖ menos minus
➗ dividir divide
✖️ multiplicar multiply
❓ interrogacao question pergunta
❔ interrogacao_branca grey_question
❗ exclamacao exclamation
‼️ dupla_exclamacao bangbang
⁉️ exclamacao_interrogacao interrobang
⚠️ atencao warning cuidado
🚫 proibido no_entry_sign
⛔ entrada_proibida no_entry
🔞 maior_18 underage
♻️ reciclar recycle
🆗 ok_botao ok_button
🆕 novo new
🆒 cool
🆓 gratis free
🆘 socorro sos
🔴 circulo_vermelho red_circle
🟠 circulo_laranja orange_circle
🟡 circulo_amarelo yellow_circle
🟢 circulo_verde green_circle
🔵 circulo_azul blue_circle
🟣 circulo_roxo purple_circle
⚫ circulo_preto black_circle
⚪ circulo_branco white_circle
🟥 quadrado_vermelho red_square
🟩 quadrado_verde green_square
🟦 quadrado_azul blue_square
🔺 triangulo_vermelho small_red_triangle
🔶 losango_laranja large_orange_diamond
➡️ seta_direita arrow_right
⬅️ seta_esquerda arrow_left
⬆️ seta_cima arrow_up
⬇️ seta_baixo arrow_down
🔄 recarregar arrows_counterclockwise
🔁 repetir repeat
▶️ play
⏸️ pausa pause
⏹️ parar stop_button
⏩ avancar fast_forward
🔇 mudo mute
🔊 volume_alto loud_sound
🎦 cinema
📶 sinal signal_strength
#️⃣ hashtag hash
🔟 dez keycap_ten
1️⃣ um one
2️⃣ dois two
3️⃣ tres three
©️ copyright
®️ registrado registered
™️ marca tm
🕐 uma_hora clock1
♾️ infinito infinity
☮️ simbolo_paz peace
☯️ yin_yang
♈ aries
⚛️ atomo atom
🆚 versus vs
💲 cifrao heavy_dollar_sign
`],
];

const EMOJIS = [];
for (const [cat, , block] of EMOJI_DATA) {
  for (const line of block.trim().split('\n')) {
    const parts = line.trim().split(/\s+/);
    const char = parts.shift();
    if (!char || !parts.length) continue;
    EMOJIS.push({ char, name: parts[0], keywords: parts.join(' ').replace(/_/g, ' '), cat });
  }
}
const EMOJI_BY_NAME = new Map();
for (const e of EMOJIS) for (const k of e.keywords.split(' ')) if (!EMOJI_BY_NAME.has(k)) EMOJI_BY_NAME.set(k, e.char);
for (const e of EMOJIS) EMOJI_BY_NAME.set(e.name, e.char);

window.EMOJI_CATEGORIES = EMOJI_DATA.map(([name, icon]) => ({ name, icon }));
window.EMOJIS = EMOJIS;
window.EMOJI_BY_NAME = EMOJI_BY_NAME;
