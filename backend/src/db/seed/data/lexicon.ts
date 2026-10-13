// Concept lexicon (docs/CONTENT_I18N.md §3). One row per concept:
//   id | gloss | en | hi | hi_rom | kn | kn_rom | ta | ta_rom
// ";" separates synonyms. Romanised columns are stored under their language (kutta → hi) so a
// Latin-script word still counts as Hindi/Kannada/Tamil for Bhasha pinches. Terms are normalised
// with @shared normalize() at seed time. Review rule: one native speaker per language before merge.
export const LEXICON_TABLE = `
c_tea | tea | tea;chai | चाय | chai;chay;chaay | ಚಹಾ;ಟೀ | chaha;chaa | தேநீர்;டீ | theneer;tea
c_coffee | coffee | coffee | कॉफ़ी;कॉफी | coffee;kofi | ಕಾಫಿ | kaapi;kapi | காபி | kaapi;kapi
c_samosa | samosa | samosa;samosas | समोसा;समोसे | samosa;samose | ಸಮೋಸ | samosa | சமோசா | samosa
c_snack | snack | snack;snacks | नाश्ता | nashta;nasta | ತಿಂಡಿ | tindi;thindi | சிற்றுண்டி;ஸ்நாக்ஸ் | sitrundi
c_chutney | chutney | chutney | चटनी | chutney;chatni | ಚಟ್ನಿ | chutney;chatni | சட்னி | chutney;chatni
c_fried | fried | fried;fry | तला हुआ | tala hua | ಕರಿದ | karida | பொரித்த | poritha
c_spicy | spicy | spicy;masala | तीखा;मसालेदार;मसाला | teekha;tikha;masaledar;masala | ಖಾರ;ಮಸಾಲೆ | khaara;kaara;masale | காரம்;மசாலா | kaaram;masala
c_idli | idli | idli;idly | इडली | idli | ಇಡ್ಲಿ | idli | இட்லி | idli;itli
c_sambar | sambar | sambar | सांभर | sambar;sambhar | ಸಾಂಬಾರ್;ಸಾರು | sambar;saaru | சாம்பார் | sambar
c_breakfast | breakfast | breakfast;tiffin | नाश्ता | nashta;nasta | ತಿಂಡಿ;ಉಪಹಾರ | tindi;thindi;upahara | டிபன்;காலை உணவு | tiffin;kaalai unavu
c_mango | mango | mango;mangoes | आम | aam | ಮಾವು;ಮಾವಿನಹಣ್ಣು | maavu;mavu;mavinahannu | மாம்பழம் | maambazham;mambalam
c_fruit | fruit | fruit;fruits | फल | phal;fal | ಹಣ್ಣು | hannu | பழம் | pazham;palam
c_yellow | yellow | yellow | पीला | peela;pila | ಹಳದಿ | haladi | மஞ்சள் | manjal
c_summer | summer | summer | गर्मी;गरमी | garmi | ಬೇಸಿಗೆ | besige | கோடை;கோடைக்காலம் | kodai
c_market | market | market;bazaar;bazar | बाज़ार;बाजार;मंडी | bazaar;bazar;mandi | ಮಾರುಕಟ್ಟೆ;ಸಂತೆ | marukatte;sante;santhe | சந்தை;மார்க்கெட் | santhai;market
c_dosa | dosa | dosa;dosai | डोसा | dosa | ದೋಸೆ | dose;dosa | தோசை | dosai;thosai
c_crispy | crispy | crispy;crunchy | कुरकुरा | kurkura | ಗರಿಗರಿ | garigari | மொறுமொறு | morumoru
c_jalebi | jalebi | jalebi | जलेबी | jalebi | ಜಿಲೇಬಿ | jilebi;jalebi | ஜிலேபி | jilebi
c_sweet | sweet | sweet;sweets;dessert;mithai | मिठाई;मीठा | mithai;meetha;mitha | ಸಿಹಿ;ಸಿಹಿತಿಂಡಿ | sihi;sihitindi | இனிப்பு;ஸ்வீட் | inippu;sweet
c_orange | orange | orange | नारंगी;संतरा | narangi;santra | ಕಿತ್ತಳೆ | kittale | ஆரஞ்சு | orange
c_panipuri | pani puri | panipuri;pani puri;golgappa;puchka | गोलगप्पे;गोलगप्पा;पानीपूरी | golgappa;golgappe;panipuri;pani puri;puchka | ಪಾನಿಪುರಿ | panipuri;paani puri | பானிபூரி | panipuri
c_street_food | street food | street food;chaat | चाट | chaat;chat | ಚಾಟ್ಸ್;ಚಾಟ್ | chaats;chaat | சாட் | chaat
c_water | water | water | पानी;जल | pani;paani;jal | ನೀರು | neeru;niru | தண்ணீர்;நீர் | thanni;thanneer;neer
c_food | food | food | खाना;भोजन | khana;khaana;bhojan | ಊಟ;ಆಹಾರ | oota;uta;aahara | உணவு;சாப்பாடு | unavu;saapadu;sapadu
c_thali | thali | thali;meals;plate | थाली | thali | ಥಾಲಿ;ಮೀಲ್ಸ್ | thali;meals | தாலி சாப்பாடு;மீல்ஸ் | meals
c_rice | rice | rice | चावल | chawal;chaawal | ಅನ್ನ;ಅಕ್ಕಿ | anna;akki | சாதம்;அரிசி | saadham;sadam;arisi
c_lunch | lunch | lunch | दोपहर का खाना | lunch | ಮಧ್ಯಾಹ್ನದ ಊಟ | lunch | மதிய உணவு | lunch
c_corn | corn | corn;bhutta;maize;sweet corn | भुट्टा;मक्का | bhutta;makka;makkai | ಜೋಳ;ಮೆಕ್ಕೆಜೋಳ | jola;mekkejola | சோளம் | solam;cholam
c_fire | fire | fire;flame;coal | आग;कोयला | aag;koyla | ಬೆಂಕಿ;ಇದ್ದಿಲು | benki;iddilu | நெருப்பு;கரி | neruppu
c_roasted | roasted | roasted;roast;grilled | भुना | bhuna;bhuna hua | ಸುಟ್ಟ | sutta | வறுத்த;சுட்ட | varutha;sutta
c_steam | steam | steam;steaming;hot steam | भाप | bhaap;bhap | ಹಬೆ | habe | ஆவி | aavi
c_glass | glass | glass;cup;tumbler | गिलास;कप | gilaas;gilas;cup | ಲೋಟ | lota;loata | டம்ளர்;கிளாஸ் | tumbler;glass
c_rain | rain | rain;rainy;raining;rainfall | बारिश;वर्षा | baarish;barish;varsha;barsaat | ಮಳೆ | male;maley | மழை | mazhai
c_umbrella | umbrella | umbrella | छाता;छतरी | chhata;chata;chatri;chhatri | ಕೊಡೆ;ಛತ್ರಿ | kode;chatri | குடை | kudai
c_street | street | street;lane | गली | gali;galli | ಬೀದಿ | beedi;bidi | தெரு | theru
c_road | road | road;highway | सड़क | sadak;sarak | ರಸ್ತೆ | raste;rasthe | சாலை;ரோடு | saalai;road
c_monsoon | monsoon | monsoon | मानसून;बरसात | monsoon;barsaat | ಮುಂಗಾರು;ಮಳೆಗಾಲ | mungaru;malegala | பருவமழை;மழைக்காலம் | paruvamazhai;mazhaikaalam
c_red | red | red | लाल | laal;lal | ಕೆಂಪು | kempu | சிவப்பு | sivappu
c_rainbow | rainbow | rainbow | इंद्रधनुष | indradhanush | ಕಾಮನಬಿಲ್ಲು | kamanabillu | வானவில் | vaanavil;vanavil
c_sky | sky | sky | आसमान;आकाश | aasmaan;asman;aakash;akash | ಆಕಾಶ;ಆಗಸ | aakasha;akasha | வானம் | vaanam;vanam
c_colours | colours | colours;colors;colour;color;colourful;colorful | रंग;रंगीन | rang;rangeen | ಬಣ್ಣ;ಬಣ್ಣಗಳು | banna;bannagalu | வண்ணம்;கலர் | vannam;colour
c_lightning | lightning | lightning;thunder;thunderstorm | बिजली | bijli | ಮಿಂಚು;ಗುಡುಗು | minchu;gudugu | மின்னல்;இடி | minnal;idi
c_storm | storm | storm;cyclone | तूफ़ान;तूफान;आंधी | toofan;tufan;aandhi | ಬಿರುಗಾಳಿ | birugaali | புயல் | puyal
c_night | night | night | रात | raat;rat | ರಾತ್ರಿ | raatri;ratri | இரவு | iravu
c_sun | sun | sun;sunny;sunshine | सूरज;धूप | suraj;sooraj;dhoop;dhup | ಸೂರ್ಯ;ಬಿಸಿಲು | surya;bisilu | சூரியன்;வெயில் | sooriyan;veyil
c_hot | hot | hot;heat | गरम;गर्म;गर्मी | garam;garmi | ಬಿಸಿ;ಸೆಖೆ | bisi;sekhe | சூடு;வெப்பம் | soodu;veppam
c_field | field | field;farm;fields | खेत | khet | ಹೊಲ;ಗದ್ದೆ | hola;gadde | வயல் | vayal
c_fog | fog | fog;mist;foggy | कोहरा;धुंध | kohra;dhundh | ಮಂಜು | manju | பனிமூட்டம் | panimoottam
c_winter | winter | winter | सर्दी;जाड़ा | sardi;jaada | ಚಳಿಗಾಲ | chaligaala | குளிர்காலம் | kulirkaalam
c_cold | cold | cold;chilly;cool | ठंडा;ठंड | thanda;thand | ಚಳಿ;ತಣ್ಣಗೆ | chali;thannage | குளிர் | kulir
c_auto | auto rickshaw | auto;rickshaw;autorickshaw;auto rickshaw;tuk tuk | ऑटो;रिक्शा | auto;rickshaw;riksha | ಆಟೋ;ರಿಕ್ಷಾ | auto;riksha | ஆட்டோ | auto
c_traffic | traffic | traffic;jam;traffic jam | ट्रैफिक;जाम | traffic;jam | ಟ್ರಾಫಿಕ್ | traffic | டிராஃபிக்;போக்குவரத்து நெரிசல் | traffic
c_car | car | car;cars;vehicle | गाड़ी;कार | gaadi;gadi;car | ಕಾರು;ಗಾಡಿ | kaaru;karu;gaadi | கார்;வண்டி | car;vandi
c_horn | horn | horn;honking;honk;beep | हॉर्न | horn;horn bajana | ಹಾರ್ನ್ | horn | ஹாரன் | horn
c_train | train | train;railway;railways | रेल;रेलगाड़ी;ट्रेन | train;rail;railgadi | ರೈಲು | railu;rail | ரயில் | rayil;train
c_station | station | station;platform;railway station | स्टेशन | station;steshan | ನಿಲ್ದಾಣ | nildana | நிலையம் | nilayam;station
c_travel | travel | travel;journey;trip;travelling;traveling | सफ़र;सफर;यात्रा | safar;yatra | ಪ್ರಯಾಣ | prayana | பயணம் | payanam
c_crowd | crowd | crowd;rush;crowded | भीड़ | bheed;bhid;bheer | ಜನಸಂದಣಿ;ರಶ್ | rush;janasandani | கூட்டம் | koottam
c_people | people | people | लोग | log;logon | ಜನ;ಜನರು | jana;janaru | மக்கள் | makkal
c_dog | dog | dog;dogs;doggy | कुत्ता;कुत्ते | kutta;kutte;kuttaa | ನಾಯಿ | naayi;nayi | நாய் | naai;nai;naay
c_puppy | puppy | puppy;pup;puppies | पिल्ला | pilla;pillaa | ನಾಯಿಮರಿ | nayimari;naayimari | நாய்க்குட்டி | naaikutti;naikutti
c_sleep | sleep | sleep;sleeping;sleepy;nap | नींद;सोना | neend;nind;sona | ನಿದ್ದೆ;ನಿದ್ರೆ | nidde;nidre | தூக்கம் | thookam
c_cow | cow | cow;cows;cattle | गाय | gaay;gai | ಹಸು;ದನ | hasu;dana | பசு;மாடு | pasu;maadu
c_animal | animal | animal;animals | जानवर | jaanwar;janwar | ಪ್ರಾಣಿ | praani;prani | விலங்கு | vilangu
c_shopping | shopping | shopping;shop | ख़रीदारी;खरीदारी | kharidari;shopping | ಶಾಪಿಂಗ್ | shopping | ஷாப்பிங் | shopping
c_lamp | lamp | lamp;lamps;diya;diyas;oil lamp | दीया;दिया;दीपक | diya;diyaa;deepak | ದೀಪ;ಹಣತೆ | deepa;hanate | விளக்கு;அகல் | vilakku;agal
c_light | light | light;lights;glow | रोशनी;प्रकाश;लाइट | roshni;prakash;light | ಬೆಳಕು | belaku | ஒளி;வெளிச்சம் | oli;velicham
c_festival | festival | festival;festivals;festive | त्योहार;त्यौहार | tyohar;tyohaar;tehwar | ಹಬ್ಬ | habba | திருவிழா;பண்டிகை | thiruvizha;pandigai
c_rangoli | rangoli | rangoli;kolam;muggu | रंगोली | rangoli | ರಂಗೋಲಿ | rangoli | கோலம் | kolam
c_art | art | art;design;pattern | कला | kala | ಕಲೆ;ಚಿತ್ರಕಲೆ | kale | கலை | kalai
c_kite | kite | kite;kites | पतंग | patang;patange | ಗಾಳಿಪಟ | gaalipata;galipata | பட்டம் | pattam
c_wind | wind | wind;windy;breeze | हवा | hawa;hava | ಗಾಳಿ | gaali;gali | காற்று | kaatru;kaathu
c_powder | coloured powder | powder;gulal | गुलाल | gulal;gulaal | ಗುಲಾಲ್;ಬಣ್ಣದ ಪುಡಿ | gulal | குலால் | gulal
c_fireworks | fireworks | fireworks;crackers;firecrackers;cracker | पटाखे;पटाखा;आतिशबाज़ी | patakhe;patakha;pataka | ಪಟಾಕಿ | pataki | பட்டாசு | pattasu
c_gift | gift | gift;gifts;present | तोहफ़ा;तोहफा;उपहार | tohfa;uphaar;gift | ಉಡುಗೊರೆ | udugore | பரிசு | parisu
c_box | box | box;packet | डिब्बा | dibba;dabba | ಡಬ್ಬಿ;ಪೆಟ್ಟಿಗೆ | dabbi;pettige | பெட்டி | petti
c_book | book | book;books;notebook | किताब;कॉपी | kitaab;kitab;copy | ಪುಸ್ತಕ | pustaka;pusthaka | புத்தகம் | puthagam;puthakam
c_pen | pen | pen;pens | पेन;कलम | pen;kalam | ಪೆನ್ನು | pennu | பேனா | pena;paena
c_study | study | study;studying;homework;studies | पढ़ाई | padhai;padhaai;padai | ಓದು | odu;oodu | படிப்பு | padippu
c_exam | exam | exam;exams;test;examination | परीक्षा;इम्तिहान | pariksha;imtihaan;exam | ಪರೀಕ್ಷೆ | pareekshe;pariksha;exam | தேர்வு;பரீட்சை | thervu;pareetchai;exam
c_canteen | canteen | canteen;cafeteria;mess | कैंटीन | canteen | ಕ್ಯಾಂಟೀನ್ | canteen | கேன்டீன் | canteen
c_friends | friends | friends;friend;friendship;buddies | दोस्त;यार;दोस्ती | dost;yaar;dosti | ಸ್ನೇಹಿತ;ಗೆಳೆಯ;ಗೆಳೆಯರು | snehita;geleya;geleyaru | நண்பன்;நண்பர்கள் | nanban;nanbargal;friends
c_college | college | college;campus | कॉलेज | college | ಕಾಲೇಜು | kaleju;college | கல்லூரி | kalloori;college
c_bag | bag | bag;backpack;schoolbag | बैग;बस्ता | bag;basta | ಬ್ಯಾಗ್;ಚೀಲ | bag;cheela | பை | pai;bag
c_school | school | school | स्कूल;विद्यालय | school;skool | ಶಾಲೆ | shaale;shale | பள்ளி | palli;school
c_cricket | cricket | cricket | क्रिकेट | cricket;kriket | ಕ್ರಿಕೆಟ್ | cricket | கிரிக்கெட் | cricket
c_bat | bat | bat | बल्ला | balla;bat | ಬ್ಯಾಟ್ | bat | மட்டை | mattai;bat
c_ball | ball | ball | गेंद | gend;ball | ಚೆಂಡು | chendu | பந்து | pandhu;panthu
c_sport | sport | sport;sports;game;match | खेल | khel | ಆಟ | aata;ata | விளையாட்டு | vilaiyattu
c_phone | phone | phone;mobile;smartphone;cellphone | फ़ोन;फोन;मोबाइल | phone;fone;mobile | ಫೋನ್;ಮೊಬೈಲ್ | phone;mobile | போன்;கைபேசி;மொபைல் | phone;mobile;kaipesi
c_battery | battery | battery;charging;low battery | बैटरी | battery;charging | ಬ್ಯಾಟರಿ | battery | பேட்டரி | battery
c_charger | charger | charger;cable;plug | चार्जर | charger | ಚಾರ್ಜರ್ | charger | சார்ஜர் | charger
c_bus | bus | bus;buses | बस | bus | ಬಸ್ಸು;ಬಸ್ | bassu;bus | பேருந்து;பஸ் | perundhu;bus
c_window | window | window;windows | खिड़की | khidki;khirki | ಕಿಟಕಿ | kitaki | ஜன்னல் | jannal
c_evening | evening | evening;dusk;sunset | शाम | shaam;sham | ಸಂಜೆ | sanje | மாலை | maalai
c_beach | beach | beach;seashore;shore | समुद्र तट;बीच | beach;samudra tat | ಕಡಲತೀರ;ಬೀಚ್ | kadalatheera;beach | கடற்கரை;பீச் | kadarkarai;beach
c_sea | sea | sea;ocean;waves | समुद्र;सागर | samundar;samudra;sagar | ಸಮುದ್ರ;ಕಡಲು | samudra;kadalu | கடல் | kadal
c_sand | sand | sand | रेत | ret;reth | ಮರಳು | maralu | மணல் | manal
c_holiday | holiday | holiday;vacation;holidays | छुट्टी;छुट्टियाँ | chhutti;chutti | ರಜೆ | raje | விடுமுறை;லீவு | vidumurai;leave
c_mountain | mountain | mountain;mountains;hills;hill | पहाड़;पर्वत | pahad;pahaad;parvat | ಬೆಟ್ಟ;ಪರ್ವತ | betta;parvata | மலை | malai
c_snow | snow | snow;snowfall | बर्फ़;बर्फ;बर्फबारी | barf;baraf;barfbari | ಹಿಮ | hima | பனி |
c_ice | ice | ice | बर्फ़;बर्फ | barf;baraf | ಐಸ್;ಮಂಜುಗಡ್ಡೆ | ice;manjugadde | ஐஸ் | ice
c_boat | boat | boat;boats;houseboat | नाव | naav;nav | ದೋಣಿ | doni | படகு | padagu
c_river | river | river;backwaters;lake | नदी | nadi | ನದಿ;ಹೊಳೆ | nadi;hole | ஆறு;நதி | aaru;nadhi
c_cycle | cycle | cycle;bicycle;cycling | साइकिल | cycle;saikil | ಸೈಕಲ್ | cycle;saikal | சைக்கிள் | cycle
c_ride | ride | ride;riding | सवारी | sawari;savari | ಸವಾರಿ | savaari | சவாரி | savaari
c_cat | cat | cat;kitten;kitty | बिल्ली | billi | ಬೆಕ್ಕು | bekku | பூனை | poonai;punai
c_banana | banana | banana;bananas | केला;केले | kela;kele | ಬಾಳೆಹಣ್ಣು | baalehannu;balehannu | வாழைப்பழம் | vaazhaipazham;valaipalam
c_elephant | elephant | elephant | हाथी | haathi;hathi | ಆನೆ | aane;ane | யானை | yaanai;yanai
c_clock | clock | clock;watch;time | घड़ी | ghadi;ghari | ಗಡಿಯಾರ | gadiyaara;gadiyara | கடிகாரம் | kadigaram
c_peacock | peacock | peacock;peahen | मोर | mor | ನವಿಲು | navilu | மயில் | mayil
c_bird | bird | bird;birds | चिड़िया;पक्षी;पंछी | chidiya;pakshi;panchi | ಹಕ್ಕಿ;ಪಕ್ಷಿ | hakki;pakshi | பறவை | paravai
c_tree | tree | tree;trees | पेड़;वृक्ष | ped;per;vriksh | ಮರ | mara | மரம் | maram
c_moon | moon | moon;full moon | चाँद;चांद;चंद्रमा | chaand;chand;chandrama | ಚಂದ್ರ;ಚಂದಿರ | chandra;chandira | நிலா;சந்திரன் | nila;nilaa;chandran
c_tiger | tiger | tiger | बाघ | baagh;bagh | ಹುಲಿ | huli | புலி | puli
c_lonely | lonely | lonely;alone;loneliness | अकेला;अकेलापन | akela;akelapan | ಒಂಟಿ;ಏಕಾಂಗಿ | onti;ekaangi | தனிமை | thanimai
c_quiet | quiet | quiet;silence;silent | चुप;सन्नाटा;शांत | chup;sannata;shaant;shant | ಮೌನ;ನಿಶ್ಶಬ್ದ | mouna;nishabda | அமைதி | amaidhi;amaithi
c_calm | calm | calm;peace;peaceful;relaxing | सुकून;शांति | sukoon;sukun;shanti | ಶಾಂತಿ;ನೆಮ್ಮದಿ | shanti;nemmadi | நிம்மதி | nimmadhi;nimmathi
c_waiting | waiting | waiting;wait | इंतज़ार;इंतजार | intezaar;intezar;intazar | ಕಾಯುವುದು | kaayuvudu;kaayodu | காத்திருப்பு | kaathiruppu
c_hope | hope | hope;hopeful | उम्मीद;आशा | ummeed;umeed;asha | ಭರವಸೆ | bharavase | நம்பிக்கை | nambikkai
c_morning | morning | morning;sunrise;dawn | सुबह;सवेरा | subah;subha;savera | ಬೆಳಿಗ್ಗೆ;ಮುಂಜಾನೆ | beligge;munjaane | காலை | kaalai
c_happy | happy | happy;happiness;joy;joyful | ख़ुश;खुश;ख़ुशी;खुशी | khush;khushi | ಖುಷಿ;ಸಂತೋಷ | khushi;santosha | மகிழ்ச்சி;சந்தோஷம் | magizhchi;santhosham
c_fun | fun | fun;masti;enjoy | मज़ा;मजा;मस्ती | maza;mazaa;masti | ಮಜಾ | maja;majaa | ஜாலி | jolly;jaali
c_comfort | comfort | cozy;cosy;comfort;relax;relaxed;comfy | आराम | aaram;araam | ಆರಾಮ | aaraama;arama | ஓய்வு | oyvu
c_tension | tension | tension;stress;nervous;pressure | तनाव;टेंशन | tension;tanav | ಒತ್ತಡ;ಟೆನ್ಷನ್ | ottada;tension | பதற்றம்;டென்ஷன் | padhattram;tension
c_fear | fear | fear;scared;afraid;scary | डर | darr;dar | ಭಯ | bhaya | பயம் | bayam;payam
c_celebration | celebration | celebration;celebrate;party | जश्न;पार्टी | jashn;party | ಸಂಭ್ರಮ;ಪಾರ್ಟಿ | sambhrama;party | கொண்டாட்டம் | kondattam;party
c_angry | angry | angry;anger;irritated;frustrated | ग़ुस्सा;गुस्सा | gussa | ಕೋಪ;ಸಿಟ್ಟು | kopa;sittu | கோபம் | kobam;kopam
c_noise | noise | noise;noisy;loud | शोर | shor | ಗದ್ದಲ;ಶಬ್ದ | gaddala;shabda | சத்தம் | satham;sattham
c_tired | tired | tired;exhausted;tiring | थका;थकान;थका हुआ | thaka;thakan;thakaan | ಸುಸ್ತು | sustu;susthu | களைப்பு;டயர்டு | kalaippu;tired
c_lazy | lazy | lazy;laziness | आलसी;आलस | aalsi;alsi;aalas | ಸೋಮಾರಿ | somari;somaari | சோம்பல் | sombal
c_pakoda | pakoda | pakoda;pakora;pakodas;bhajji;bajji;bhaji | पकौड़ा;पकौड़े;पकोड़े | pakoda;pakode;pakora;bhajiya | ಬಜ್ಜಿ;ಪಕೋಡ | bajji;pakoda | பஜ்ஜி;பக்கோடா | bajji;pakkoda
c_noodles | noodles | noodles;maggi | नूडल्स | noodles;maggi | ನೂಡಲ್ಸ್ | noodles | நூடுல்ஸ் | noodles
c_work | work | work;office;job | काम;दफ़्तर;ऑफिस | kaam;office;daftar | ಕೆಲಸ;ಆಫೀಸ್ | kelasa;office | வேலை | velai;office
c_alarm | alarm | alarm;alarm clock | अलार्म | alarm | ಅಲಾರಾಂ | alarm | அலாரம் | alarm
c_cooker | pressure cooker | pressure cooker;cooker;whistle | कुकर;सीटी | cooker;kukar;seeti;siti | ಕುಕ್ಕರ್;ಸೀಟಿ | cooker;seeti | குக்கர்;விசில் | cooker;whistle
c_wallet | wallet | wallet;purse | बटुआ;पर्स | batua;purse | ಪರ್ಸ್ | purse | பர்ஸ் | purse
c_keys | keys | keys;key | चाबी | chaabi;chabi | ಕೀಲಿ | keeli;key | சாவி | saavi;chavi
c_bottle | bottle | bottle;water bottle | बोतल | botal;bottle | ಬಾಟಲಿ | baatali;bottle | பாட்டில் | bottle
c_lassi | lassi / buttermilk | lassi;buttermilk;chaas | लस्सी;छाछ | lassi;chhaach;chaas | ಮಜ್ಜಿಗೆ;ಲಸ್ಸಿ | majjige;lassi | மோர்;லஸ்ஸி | moru;lassi
c_lemonade | lemonade | lemonade;lemon water;nimbu pani;shikanji;lime juice | नींबू पानी;शिकंजी | nimbu pani;nimbu paani;shikanji | ನಿಂಬೆ ಪಾನಕ;ಲಿಂಬೆ ಜ್ಯೂಸ್ | nimbe panaka;lime juice | எலுமிச்சை சாறு | elumichai saaru;lemon juice
c_coconut_water | coconut water | coconut water;tender coconut;coconut | नारियल पानी;नारियल | nariyal pani;nariyal | ಎಳನೀರು | elaneeru;elaneer | இளநீர் | ilaneer;elaneer
c_juice | juice | juice;sugarcane juice | जूस;रस | juice;ras;ganne ka ras | ಜ್ಯೂಸ್;ರಸ | juice;rasa;kabbina haalu | ஜூஸ்;சாறு | juice;saaru
c_six | six | six;sixer;boundary;four | छक्का;चौका | chakka;chhakka;chauka | ಸಿಕ್ಸರ್ | sixer | சிக்ஸர் | sixer
c_wicket | wicket | wicket;out;bowled | विकेट;आउट | wicket;out | ವಿಕೆಟ್;ಔಟ್ | wicket;out | விக்கெட்;அவுட் | wicket;out
c_brush | brush | brush;toothbrush;teeth;toothpaste | ब्रश;मंजन | brush;manjan | ಬ್ರಷ್ | brush | பிரஷ் | brush
c_pink | pink | pink | गुलाबी | gulabi | ಗುಲಾಬಿ | gulabi;pink | இளஞ்சிவப்பு | pink
c_vada_pav | vada pav | vada pav;vadapav | वड़ा पाव;वडा पाव | vada pav;vadapav | ವಡಾ ಪಾವ್ | vada pav | வடா பாவ் | vada pav
c_momos | momos | momos;momo;dumplings | मोमोज़;मोमोज;मोमो | momos;momo | ಮೊಮೊಸ್ | momos | மோமோஸ் | momos
c_wedding | wedding | wedding;marriage | शादी;विवाह | shaadi;shadi;vivah | ಮದುವೆ | maduve;maduve | கல்யாணம்;திருமணம் | kalyanam;thirumanam
c_dance | dance | dance;dancing | नाच;नृत्य;डांस | naach;nach;dance | ಡ್ಯಾನ್ಸ್;ನೃತ್ಯ | dance;nritya | நடனம்;டான்ஸ் | nadanam;dance
c_music | music | music;songs;song;dj | संगीत;गाना;गाने | sangeet;gaana;gana;gaane | ಸಂಗೀತ;ಹಾಡು | sangeeta;haadu;hadu | இசை;பாட்டு | isai;paattu;pattu
c_pillow | pillow | pillow | तकिया | takiya | ದಿಂಬು | dimbu | தலையணை | thalaiyanai
c_fan | fan | fan;ceiling fan | पंखा | pankha;panka | ಫ್ಯಾನ್ | fan | மின்விசிறி;ஃபேன் | fan
c_ice_cream | ice cream | ice cream;icecream;kulfi | आइसक्रीम;कुल्फ़ी;कुल्फी | icecream;ice cream;kulfi | ಐಸ್ ಕ್ರೀಮ್ | ice cream;icecream | ஐஸ்கிரீம் | ice cream;icecream
c_fridge | fridge | fridge;refrigerator | फ्रिज | fridge;frij | ಫ್ರಿಜ್ | fridge | ஃப்ரிட்ஜ் | fridge
c_attendance | attendance | attendance;proxy | हाज़िरी;हाजिरी | haaziri;hajiri;attendance | ಹಾಜರಾತಿ | haajaraati;attendance | வருகை | varugai;attendance
c_viva | viva | viva;interview;presentation | मौखिक | viva | ವೈವಾ | viva | வைவா | viva
c_results | results | results;result;marks;grades | नतीजा;रिज़ल्ट | nateeja;natija;result | ಫಲಿತಾಂಶ | phalitamsha;result | முடிவு;ரிசல்ட் | mudivu;result
c_laddu | laddu | laddu;ladoo;laddoo | लड्डू | laddu;ladoo;ladu | ಲಾಡು | laadu;ladu | லட்டு | lattu;laddu
c_gulab_jamun | gulab jamun | gulab jamun;jamun | गुलाब जामुन | gulab jamun | ಜಾಮೂನು | jamoon;jamun | குலாப் ஜாமூன் | gulab jamun
c_rasgulla | rasgulla | rasgulla;rasagola;rosogolla | रसगुल्ला | rasgulla;rasgula | ರಸಗುಲ್ಲ | rasgulla | ரசகுல்லா | rasagulla
c_ac | ac / cooler | ac;air conditioner;cooler | एसी;कूलर | ac;cooler | ಎಸಿ | ac | ஏசி | ac
c_sweat | sweat | sweat;sweating;sweaty | पसीना | paseena;pasina | ಬೆವರು | bevaru | வியர்வை | viyarvai
c_poha | poha | poha;avalakki;aval;flattened rice | पोहा | poha | ಅವಲಕ್ಕಿ | avalakki | அவல் | aval
c_paratha | paratha | paratha;parantha;parotta | पराठा | paratha;parantha | ಪರೋಟ | parota;paratha | பரோட்டா | parotta
c_bread | bread | bread;toast;bun | ब्रेड;डबल रोटी | bread;double roti | ಬ್ರೆಡ್ | bread | ரொட்டி;பிரெட் | rotti;bread
c_candle | candle | candle;candles | मोमबत्ती | mombatti;mombati | ಮೇಣದಬತ್ತಿ | menadabatti | மெழுகுவர்த்தி | mezhuguvarthi
c_torch | torch | torch;flashlight;emergency light | टॉर्च | torch | ಟಾರ್ಚ್ | torch | டார்ச் | torch
c_eat | eat | eat;eating;have food | खाओ;खा लो | khao;kha lo | ತಿನ್ನು;ಊಟ ಮಾಡು | tinnu;oota madu | சாப்பிடு | saapidu;sapdu
c_home | home | home;house;come home | घर | ghar | ಮನೆ | mane | வீடு | veedu
c_weekend | weekend | weekend;sunday;saturday | वीकेंड;इतवार | weekend;itwar | ವೀಕೆಂಡ್ | weekend | வார இறுதி | weekend
c_movie | movie | movie;film;cinema;movies | फ़िल्म;फिल्म;पिक्चर | film;picture;movie | ಸಿನಿಮಾ;ಚಿತ್ರ | cinema;chitra | படம்;சினிமா | padam;cinema
c_soil | soil | soil;mud;petrichor;earth;smell of rain | मिट्टी | mitti;mitti ki khushboo | ಮಣ್ಣು | mannu | மண் | mann;man vaasanai
c_wet | wet | wet;damp | गीला | geela;gila | ಒದ್ದೆ | odde | ஈரம் | eeram
c_mixer | mixer | mixer;grinder;blender;mixie | मिक्सी;मिक्सर | mixie;mixer | ಮಿಕ್ಸಿ | mixie;mixi | மிக்ஸி | mixie
c_tadka | tadka | tadka;tempering;sizzle;sizzling | तड़का;छौंक | tadka;tadkaa;chhaunk | ಒಗ್ಗರಣೆ | oggarane | தாளிப்பு | thalippu
c_white | white | white | सफ़ेद;सफेद | safed | ಬಿಳಿ | bili | வெள்ளை | vellai
c_kerala | kerala | kerala | केरल | kerala | ಕೇರಳ | kerala | கேரளா | kerala
`;

/** Related concepts → near pinches ("Almost pinched!"). Order inside a pair doesn't matter. */
export const CONCEPT_EDGES: [string, string][] = [
  ["c_dog", "c_puppy"], ["c_dog", "c_animal"], ["c_cow", "c_animal"], ["c_cat", "c_animal"], ["c_elephant", "c_animal"],
  ["c_tiger", "c_animal"], ["c_peacock", "c_bird"], ["c_rain", "c_monsoon"], ["c_rain", "c_storm"], ["c_storm", "c_lightning"],
  ["c_quiet", "c_calm"], ["c_sleep", "c_tired"], ["c_tired", "c_lazy"], ["c_sweet", "c_jalebi"], ["c_sweet", "c_laddu"],
  ["c_sweet", "c_gulab_jamun"], ["c_sweet", "c_rasgulla"], ["c_mango", "c_fruit"], ["c_banana", "c_fruit"], ["c_tea", "c_coffee"],
  ["c_thali", "c_food"], ["c_thali", "c_rice"], ["c_lassi", "c_juice"], ["c_juice", "c_lemonade"], ["c_ice", "c_cold"],
  ["c_snow", "c_cold"], ["c_snow", "c_ice"], ["c_winter", "c_cold"], ["c_hot", "c_summer"], ["c_sun", "c_hot"],
  ["c_night", "c_moon"], ["c_festival", "c_celebration"], ["c_lamp", "c_light"], ["c_fireworks", "c_celebration"],
  ["c_friends", "c_fun"], ["c_happy", "c_fun"], ["c_book", "c_study"], ["c_exam", "c_study"], ["c_exam", "c_results"],
  ["c_exam", "c_tension"], ["c_fear", "c_tension"], ["c_noise", "c_horn"], ["c_traffic", "c_horn"], ["c_traffic", "c_car"],
  ["c_auto", "c_traffic"], ["c_bus", "c_travel"], ["c_train", "c_travel"], ["c_beach", "c_sea"], ["c_sea", "c_sand"],
  ["c_boat", "c_river"], ["c_cycle", "c_ride"], ["c_phone", "c_battery"], ["c_battery", "c_charger"], ["c_road", "c_street"],
  ["c_school", "c_college"], ["c_cricket", "c_sport"], ["c_bat", "c_cricket"], ["c_ball", "c_cricket"], ["c_six", "c_cricket"],
  ["c_wicket", "c_cricket"], ["c_morning", "c_sun"], ["c_panipuri", "c_street_food"], ["c_samosa", "c_snack"],
  ["c_pakoda", "c_snack"], ["c_momos", "c_street_food"], ["c_vada_pav", "c_street_food"], ["c_idli", "c_breakfast"],
  ["c_dosa", "c_breakfast"], ["c_poha", "c_breakfast"], ["c_paratha", "c_breakfast"], ["c_bread", "c_breakfast"],
  ["c_noodles", "c_snack"], ["c_kite", "c_wind"], ["c_colours", "c_rangoli"], ["c_colours", "c_powder"], ["c_ac", "c_fan"],
  ["c_sweat", "c_hot"], ["c_soil", "c_rain"], ["c_wet", "c_rain"], ["c_canteen", "c_college"], ["c_canteen", "c_food"],
  ["c_evening", "c_night"], ["c_lonely", "c_quiet"], ["c_corn", "c_roasted"], ["c_fire", "c_roasted"], ["c_glass", "c_tea"],
  ["c_steam", "c_hot"], ["c_market", "c_shopping"], ["c_crowd", "c_people"], ["c_wedding", "c_celebration"],
  ["c_dance", "c_music"], ["c_ice_cream", "c_cold"], ["c_fridge", "c_cold"], ["c_candle", "c_light"], ["c_torch", "c_light"],
];

/** Words that never match (docs/CONTENT_I18N.md §3). Single characters are rejected in code. */
export const LOW_INFO_WORDS = [
  "thing", "things", "stuff", "nice", "good", "bad", "ok", "okay", "photo", "pic", "picture", "image", "yes", "no",
  "idk", "nothing", "something", "anything", "everything", "same", "pinch", "word", "words", "hmm", "lol", "na",
  "haan", "nahi", "nahin", "accha", "acha", "achha", "theek", "thik", "chennagide", "chennagi", "illa", "houdu",
  "sari", "nalla", "nallathu", "aamam", "illai", "best", "great", "random", "dont know", "pass",
];
