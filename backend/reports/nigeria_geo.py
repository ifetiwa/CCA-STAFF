"""Nigeria geography helpers for reports.

Two derivations that the Staff model does not store directly:

* **Geopolitical zone** — a function of the state of origin (6 zones + FCT).
* **Senatorial district** — a function of *state + LGA*. Each state is split
  into three senatorial districts (the FCT has a single one covering its six
  area councils). The mapping below lists every LGA under its district so we
  can look it up from the ``(state, lga)`` pair.

Both derivations are tolerant of the messy, inconsistent spellings that appear
in imported data ("MUNICIPAL-AREA-COUNCIL", "Nasarawa Eggon", "OTURKPO", …):
names are compared through :func:`_key`, which upper-cases, drops punctuation
and collapses whitespace, and a small ``_ALIASES`` table patches the handful of
genuine spelling variants that normalisation alone cannot reconcile.

Anything that cannot be resolved returns ``""`` (never raises), so exports keep
working even when a record has an unfamiliar or blank state/LGA.
"""
from __future__ import annotations

import re
from datetime import date, datetime

# ---------------------------------------------------------------------------
# Normalisation
# ---------------------------------------------------------------------------

def _key(value: str) -> str:
    """Canonical comparison key: upper-case, alnum-only, single-spaced."""
    if not value:
        return ""
    s = re.sub(r"[^A-Za-z0-9]+", " ", str(value)).strip().upper()
    # Drop a trailing LGA/L.G.A qualifier if present.
    s = re.sub(r"\b(LGA|L G A|LOCAL GOVERNMENT( AREA)?|AREA COUNCIL)\b", " ", s)
    return re.sub(r"\s+", " ", s).strip()


# LGA spelling variants seen in real data -> canonical LGA key.
_ALIASES = {
    "AMAC": "ABUJA MUNICIPAL",
    "MUNICIPAL AREA COUNCIL": "ABUJA MUNICIPAL",
    "ABUJA MUNICIPAL AREA COUNCIL": "ABUJA MUNICIPAL",
    "NASARAWA EGON": "NASARAWA EGGON",
    "MOBI NORTH": "MUBI NORTH",
    "MOBI SOUTH": "MUBI SOUTH",
    "PANSHKIN": "PANKSHIN",
    "LANGTAN NORTH": "LANGTANG NORTH",
    "LANGTAN SOUTH": "LANGTANG SOUTH",
    "IKA NORTH": "IKA NORTH EAST",
    "ILESHA EAST": "ILESA EAST",
    "ILESHA WEST": "ILESA WEST",
    "ATAKUNMOSA": "ATAKUNMOSA EAST",
    "KOGI KK": "KOGI",
    "OGBOMOSHO NORTH": "OGBOMOSO NORTH",
    "OGBOMOSHO SOUTH": "OGBOMOSO SOUTH",
    "IBADAN SOUTH WEST": "IBADAN SOUTH WEST",
    "NSIT UBUIM": "NSIT UBIUM",
    "KATAGUN": "KATAGUM",
    "GWER": "GWER WEST",
    "OTURKPO": "OTUKPO",
    "IGUEGBEN": "IGUEBEN",
    "AHIAZU": "AHIAZU MBAISE",
    "MBATOLI": "MBAITOLI",
    "OKE ORO": "OKE ERO",
    "IFAKO IJAYE": "IFAKO IJAIYE",
    "OGUN WATERFRONT": "OGUN WATERSIDE",
    "EMUOHA": "EMOHUA",
    "WAMAKO": "WAMAKKO",
}


# ---------------------------------------------------------------------------
# Geopolitical zones
# ---------------------------------------------------------------------------

_ZONE_BY_STATE = {
    # North Central
    "BENUE": "North Central", "KOGI": "North Central", "KWARA": "North Central",
    "NASARAWA": "North Central", "NIGER": "North Central", "PLATEAU": "North Central",
    "FCT": "North Central", "FEDERAL CAPITAL TERRITORY": "North Central",
    "ABUJA": "North Central",
    # North East
    "ADAMAWA": "North East", "BAUCHI": "North East", "BORNO": "North East",
    "GOMBE": "North East", "TARABA": "North East", "YOBE": "North East",
    # North West
    "JIGAWA": "North West", "KADUNA": "North West", "KANO": "North West",
    "KATSINA": "North West", "KEBBI": "North West", "SOKOTO": "North West",
    "ZAMFARA": "North West",
    # South East
    "ABIA": "South East", "ANAMBRA": "South East", "EBONYI": "South East",
    "ENUGU": "South East", "IMO": "South East",
    # South South
    "AKWA IBOM": "South South", "BAYELSA": "South South", "CROSS RIVER": "South South",
    "DELTA": "South South", "EDO": "South South", "RIVERS": "South South",
    # South West
    "EKITI": "South West", "LAGOS": "South West", "OGUN": "South West",
    "ONDO": "South West", "OSUN": "South West", "OYO": "South West",
}


def geopolitical_zone(state: str) -> str:
    """Return the geopolitical zone for a state, or '' if unknown."""
    return _ZONE_BY_STATE.get(_key(state), "")


# ---------------------------------------------------------------------------
# Senatorial districts:  STATE_KEY -> { "District name": [LGA, LGA, ...] }
# ---------------------------------------------------------------------------

_SENATORIAL = {
    "ABIA": {
        "Abia Central": ["Ikwuano", "Umuahia North", "Umuahia South",
                          "Isiala Ngwa North", "Isiala Ngwa South"],
        "Abia North": ["Arochukwu", "Bende", "Isuikwuato", "Ohafia", "Umunneochi"],
        "Abia South": ["Aba North", "Aba South", "Obingwa", "Osisioma",
                       "Ugwunagbo", "Ukwa East", "Ukwa West"],
    },
    "ADAMAWA": {
        "Adamawa North": ["Madagali", "Michika", "Mubi North", "Mubi South",
                          "Maiha", "Hong", "Gombi"],
        "Adamawa Central": ["Yola North", "Yola South", "Girei", "Fufore", "Song"],
        "Adamawa South": ["Numan", "Demsa", "Lamurde", "Guyuk", "Shelleng",
                          "Ganye", "Jada", "Toungo", "Mayo-Belwa"],
    },
    "AKWA IBOM": {
        "Akwa Ibom North-East": ["Uyo", "Etinan", "Ibesikpo Asutan", "Ibiono Ibom",
                                 "Itu", "Nsit Atai", "Nsit Ibom", "Nsit Ubium", "Uruan"],
        "Akwa Ibom North-West": ["Abak", "Essien Udim", "Etim Ekpo", "Ika", "Ikono",
                                 "Ikot Ekpene", "Ini", "Obot Akara", "Oruk Anam", "Ukanafun"],
        "Akwa Ibom South": ["Eket", "Esit Eket", "Ibeno", "Mbo", "Okobo", "Onna",
                            "Oron", "Udung Uko", "Urue-Offong/Oruko", "Mkpat Enin",
                            "Ikot Abasi", "Eastern Obolo"],
    },
    "ANAMBRA": {
        "Anambra North": ["Anambra East", "Anambra West", "Ayamelum", "Awka North",
                          "Onitsha North", "Onitsha South", "Oyi"],
        "Anambra Central": ["Awka South", "Dunukofia", "Idemili North", "Idemili South",
                            "Njikoka", "Anaocha"],
        "Anambra South": ["Aguata", "Ekwusigo", "Ihiala", "Nnewi North", "Nnewi South",
                          "Orumba North", "Orumba South", "Ogbaru"],
    },
    "BAUCHI": {
        "Bauchi Central": ["Darazo", "Ganjuwa", "Misau", "Ningi", "Warji", "Kirfi"],
        "Bauchi North": ["Gamawa", "Itas/Gadau", "Jama'are", "Katagum", "Shira", "Zaki",
                         "Giade"],
        "Bauchi South": ["Alkaleri", "Bauchi", "Bogoro", "Dass", "Tafawa Balewa",
                         "Toro"],
    },
    "BAYELSA": {
        "Bayelsa East": ["Brass", "Nembe", "Ogbia"],
        "Bayelsa Central": ["Kolokuma/Opokuma", "Sagbama", "Yenagoa"],
        "Bayelsa West": ["Ekeremor", "Southern Ijaw"],
    },
    "BENUE": {
        "Benue North-East": ["Kwande", "Ushongo", "Katsina-Ala", "Logo", "Ukum",
                             "Vandeikya", "Konshisha"],
        "Benue North-West": ["Gboko", "Tarka", "Buruku", "Gwer East", "Gwer West",
                             "Guma", "Makurdi"],
        "Benue South": ["Ado", "Agatu", "Apa", "Obi", "Ogbadibo", "Ohimini", "Oju",
                        "Okpokwu", "Otukpo"],
    },
    "BORNO": {
        "Borno North": ["Abadam", "Guzamala", "Gubio", "Kukawa", "Mobbar", "Monguno",
                        "Nganzai", "Kaga", "Magumeri"],
        "Borno Central": ["Maiduguri", "Jere", "Konduga", "Mafa", "Dikwa", "Bama",
                          "Ngala", "Kala/Balge", "Marte"],
        "Borno South": ["Askira/Uba", "Bayo", "Biu", "Chibok", "Damboa", "Gwoza",
                        "Hawul", "Kwaya Kusar", "Shani"],
    },
    "CROSS RIVER": {
        "Cross River North": ["Bekwarra", "Obanliku", "Obudu", "Ogoja", "Yala"],
        "Cross River Central": ["Abi", "Boki", "Ikom", "Obubra", "Yakurr", "Etung"],
        "Cross River South": ["Akamkpa", "Akpabuyo", "Bakassi", "Biase", "Calabar Municipal",
                             "Calabar South", "Odukpani"],
    },
    "DELTA": {
        "Delta North": ["Aniocha North", "Aniocha South", "Ika North East", "Ika South",
                        "Ndokwa East", "Ndokwa West", "Oshimili North", "Oshimili South",
                        "Ukwuani"],
        "Delta Central": ["Ethiope East", "Ethiope West", "Okpe", "Sapele", "Udu",
                          "Ughelli North", "Ughelli South", "Uvwie"],
        "Delta South": ["Bomadi", "Burutu", "Isoko North", "Isoko South", "Patani",
                        "Warri North", "Warri South", "Warri South West"],
    },
    "EBONYI": {
        "Ebonyi North": ["Abakaliki", "Ebonyi", "Izzi", "Ohaukwu"],
        "Ebonyi Central": ["Ezza North", "Ezza South", "Ikwo", "Ishielu"],
        "Ebonyi South": ["Afikpo North", "Afikpo South", "Ivo", "Ohaozara", "Onicha"],
    },
    "EDO": {
        "Edo North": ["Akoko-Edo", "Etsako Central", "Etsako East", "Etsako West",
                      "Owan East", "Owan West"],
        "Edo Central": ["Esan Central", "Esan North-East", "Esan South-East",
                        "Esan West", "Igueben"],
        "Edo South": ["Egor", "Ikpoba-Okha", "Oredo", "Orhionmwon", "Ovia North-East",
                      "Ovia South-West", "Uhunmwonde"],
    },
    "EKITI": {
        "Ekiti North": ["Ido/Osi", "Ikole", "Ilejemeje", "Moba", "Oye"],
        "Ekiti Central": ["Ado-Ekiti", "Efon", "Ekiti West", "Ijero", "Irepodun/Ifelodun"],
        "Ekiti South": ["Ekiti East", "Ekiti South-West", "Emure", "Gbonyin",
                        "Ise/Orun"],
    },
    "ENUGU": {
        "Enugu North": ["Igbo-Eze North", "Igbo-Eze South", "Isi-Uzo", "Nsukka",
                        "Udenu", "Uzo-Uwani"],
        "Enugu East": ["Enugu East", "Enugu North", "Enugu South", "Isi-Uzo",
                       "Nkanu East", "Nkanu West"],
        "Enugu West": ["Aninri", "Awgu", "Ezeagu", "Igbo-Etiti", "Oji River", "Udi"],
    },
    "GOMBE": {
        "Gombe Central": ["Akko", "Yamaltu/Deba"],
        "Gombe North": ["Dukku", "Funakaye", "Gombe", "Kwami", "Nafada"],
        "Gombe South": ["Balanga", "Billiri", "Kaltungo", "Shongom"],
    },
    "IMO": {
        "Imo North (Okigwe)": ["Ehime Mbano", "Ihitte/Uboma", "Isiala Mbano",
                               "Okigwe", "Onuimo", "Obowo"],
        "Imo East (Owerri)": ["Aboh Mbaise", "Ahiazu Mbaise", "Ezinihitte", "Ikeduru",
                              "Mbaitoli", "Ngor Okpala", "Owerri Municipal",
                              "Owerri North", "Owerri West"],
        "Imo West (Orlu)": ["Ideato North", "Ideato South", "Isu", "Njaba", "Nkwerre",
                            "Nwangele", "Oguta", "Ohaji/Egbema", "Orlu", "Orsu",
                            "Oru East", "Oru West"],
    },
    "JIGAWA": {
        "Jigawa North-East": ["Birniwa", "Guri", "Hadejia", "Kafin Hausa", "Kaugama",
                              "Kiri Kasama", "Auyo", "Malam Madori"],
        "Jigawa North-West": ["Babura", "Garki", "Gumel", "Gagarawa", "Maigatari",
                              "Sule Tankarkar", "Ringim", "Taura"],
        "Jigawa South-West": ["Birnin Kudu", "Buji", "Dutse", "Gwaram", "Gwiwa",
                             "Kazaure", "Kiyawa", "Miga", "Roni", "Yankwashi", "Jahun"],
    },
    "KADUNA": {
        "Kaduna Central": ["Birnin Gwari", "Chikun", "Giwa", "Igabi", "Kaduna North",
                           "Kaduna South", "Kajuru"],
        "Kaduna North": ["Ikara", "Kubau", "Kudan", "Lere", "Makarfi", "Sabon Gari",
                         "Soba", "Zaria"],
        "Kaduna South": ["Jaba", "Jema'a", "Kachia", "Kagarko", "Kaura", "Kauru",
                         "Sanga", "Zangon Kataf"],
    },
    "KANO": {
        "Kano Central": ["Dala", "Fagge", "Gwale", "Kano Municipal", "Nassarawa",
                         "Nasarawa",
                         "Tarauni", "Ungogo", "Kumbotso", "Dawakin Tofa", "Tofa",
                         "Rimin Gado", "Bagwai", "Gezawa", "Gabasawa", "Minjibir",
                         "Ajingi", "Gaya", "Albasu", "Takai", "Sumaila"],
        "Kano North": ["Bichi", "Bunkure", "Dambatta", "Dawakin Kudu", "Garun Mallam",
                       "Kabo", "Kibiya", "Kiru", "Kunchi", "Madobi", "Makoda", "Rano",
                       "Rogo", "Shanono", "Tsanyawa", "Wudil", "Warawa", "Gwarzo",
                       "Karaye", "Garko", "Bebeji"],
        "Kano South": ["Doguwa", "Tudun Wada", "Sumaila", "Takai", "Garko", "Kibiya",
                       "Rano", "Bunkure", "Kura", "Bebeji", "Kiru", "Rogo"],
    },
    "KATSINA": {
        "Katsina Central": ["Batagarawa", "Charanchi", "Dan Musa", "Dutsin-Ma", "Jibia",
                            "Kaita", "Katsina", "Kurfi", "Rimi", "Batsari", "Safana"],
        "Katsina North": ["Bakori", "Danja", "Faskari", "Funtua", "Kafur", "Kankara",
                          "Malumfashi", "Musawa", "Bindawa"],
        "Katsina South": ["Baure", "Bindawa", "Daura", "Dutsi", "Ingawa", "Kankia",
                          "Kusada", "Mai'adua", "Mani", "Mashi", "Sandamu", "Zango"],
    },
    "KEBBI": {
        "Kebbi Central": ["Aleiro", "Gwandu", "Jega", "Kalgo", "Maiyama", "Bunza",
                          "Birnin Kebbi"],
        "Kebbi North": ["Argungu", "Augie", "Arewa Dandi", "Bagudo", "Dandi", "Suru"],
        "Kebbi South": ["Bunza", "Danko/Wasagu", "Fakai", "Ngaski", "Sakaba", "Shanga",
                        "Yauri", "Zuru", "Koko/Besse"],
    },
    "KOGI": {
        "Kogi Central": ["Adavi", "Ajaokuta", "Okehi", "Okene", "Ogori/Magongo"],
        "Kogi East": ["Ankpa", "Bassa", "Dekina", "Ibaji", "Idah", "Igalamela-Odolu",
                      "Ofu", "Olamaboro", "Omala"],
        "Kogi West": ["Kabba/Bunu", "Ijumu", "Lokoja", "Mopa-Muro", "Yagba East",
                      "Yagba West", "Kogi"],
    },
    "KWARA": {
        "Kwara Central": ["Asa", "Ilorin East", "Ilorin South", "Ilorin West", "Moro"],
        "Kwara North": ["Baruten", "Edu", "Kaiama", "Moro", "Pategi"],
        "Kwara South": ["Ekiti", "Ifelodun", "Irepodun", "Isin", "Offa", "Oke Ero",
                        "Oyun"],
    },
    "LAGOS": {
        "Lagos West": ["Alimosho", "Agege", "Ifako-Ijaiye", "Ikeja", "Mushin", "Oshodi-Isolo",
                       "Amuwo-Odofin", "Ojo", "Badagry"],
        "Lagos Central": ["Lagos Island", "Lagos Mainland", "Surulere", "Apapa",
                          "Eti-Osa", "Ikoyi"],
        "Lagos East": ["Kosofe", "Somolu", "Epe", "Ibeju-Lekki", "Ikorodu"],
    },
    "NASARAWA": {
        "Nasarawa North": ["Akwanga", "Nasarawa Eggon", "Wamba"],
        "Nasarawa West": ["Karu", "Keffi", "Kokona", "Nasarawa", "Toto"],
        "Nasarawa South": ["Awe", "Doma", "Keana", "Lafia", "Obi"],
    },
    "NIGER": {
        "Niger East": ["Bosso", "Chanchaga", "Gurara", "Munya", "Paikoro", "Rafi",
                       "Shiroro", "Tafa", "Suleja"],
        "Niger North": ["Agwara", "Borgu", "Kontagora", "Magama", "Mariga", "Mashegu",
                        "Rijau", "Wushishi"],
        "Niger South": ["Agaie", "Bida", "Edati", "Gbako", "Katcha", "Lapai", "Lavun",
                        "Mokwa"],
    },
    "OGUN": {
        "Ogun Central": ["Abeokuta North", "Abeokuta South", "Ewekoro", "Ifo", "Odeda",
                         "Obafemi Owode"],
        "Ogun East": ["Ijebu East", "Ijebu North", "Ijebu North East", "Ijebu Ode",
                      "Ikenne", "Odogbolu", "Ogun Waterside", "Remo North", "Sagamu"],
        "Ogun West": ["Ado-Odo/Ota", "Egbado North", "Egbado South", "Ipokia",
                      "Imeko Afon", "Yewa North", "Yewa South"],
    },
    "ONDO": {
        "Ondo North": ["Akoko North-East", "Akoko North-West", "Akoko South-East",
                       "Akoko South-West", "Ose", "Owo"],
        "Ondo Central": ["Akure North", "Akure South", "Idanre", "Ifedore", "Ondo East",
                         "Ondo West"],
        "Ondo South": ["Ese-Odo", "Ilaje", "Irele", "Odigbo", "Okitipupa"],
    },
    "OSUN": {
        "Osun Central": ["Egbedore", "Ede North", "Ede South", "Ife North", "Ife South",
                         "Ife Central", "Ife East", "Osogbo", "Olorunda", "Irewole",
                         "Isokan", "Ayedaade"],
        "Osun East": ["Atakunmosa East", "Atakunmosa West", "Ilesa East", "Ilesa West",
                      "Obokun", "Oriade", "Ife Central", "Ife East", "Ife North",
                      "Ife South", "Boripe", "Boluwaduro", "Ifedayo", "Ila", "Odo-Otin"],
        "Osun West": ["Aiyedire", "Ede North", "Ede South", "Egbedore", "Ejigbo", "Ewu",
                      "Isokan", "Irewole", "Iwo", "Ola Oluwa", "Ayedaade"],
    },
    "OYO": {
        "Oyo Central": ["Afijio", "Atiba", "Lagelu", "Ogbomoso North", "Ogbomoso South",
                        "Ogo Oluwa", "Orire", "Oyo East", "Oyo West", "Surulere"],
        "Oyo North": ["Atisbo", "Irepo", "Itesiwaju", "Iwajowa", "Kajola", "Olorunsogo",
                      "Orelope", "Saki East", "Saki West", "Iseyin", "Ibarapa North",
                      "Ibarapa Central", "Ibarapa East"],
        "Oyo South": ["Egbeda", "Ibadan North", "Ibadan North-East", "Ibadan North-West",
                      "Ibadan South-East", "Ibadan South-West", "Akinyele", "Ido",
                      "Lagelu", "Ona Ara", "Oluyole"],
    },
    "PLATEAU": {
        "Plateau North": ["Barkin Ladi", "Bassa", "Jos East", "Jos North", "Jos South",
                          "Riyom"],
        "Plateau Central": ["Bokkos", "Kanam", "Kanke", "Mangu", "Pankshin"],
        "Plateau South": ["Langtang North", "Langtang South", "Mikang", "Qua'an Pan",
                          "Shendam", "Wase"],
    },
    "RIVERS": {
        "Rivers East": ["Emohua", "Etche", "Ikwerre", "Obio/Akpor", "Omuma",
                        "Port Harcourt", "Ogu/Bolo", "Eleme", "Oyigbo", "Tai"],
        "Rivers West": ["Abua/Odual", "Ahoada East", "Ahoada West", "Akuku-Toru",
                        "Asari-Toru", "Degema", "Bonny", "Degema"],
        "Rivers South-East": ["Andoni", "Gokana", "Khana", "Opobo/Nkoro", "Eleme",
                             "Oyigbo", "Tai"],
    },
    "SOKOTO": {
        "Sokoto Central": ["Sokoto North", "Sokoto South", "Wamakko", "Kware", "Dange Shuni",
                           "Bodinga", "Tureta"],
        "Sokoto East": ["Goronyo", "Wurno", "Rabah", "Isa", "Sabon Birni", "Gada",
                        "Illela", "Gwadabawa"],
        "Sokoto North": ["Binji", "Silame", "Kebbe", "Tambuwal", "Yabo", "Shagari",
                         "Tangaza", "Gudu"],
    },
    "TARABA": {
        "Taraba North": ["Ardo Kola", "Jalingo", "Lau", "Yorro", "Zing", "Karim Lamido"],
        "Taraba Central": ["Bali", "Gassol", "Gashaka", "Kurmi", "Sardauna"],
        "Taraba South": ["Donga", "Ibi", "Takum", "Ussa", "Wukari"],
    },
    "YOBE": {
        "Yobe North": ["Yusufari", "Geidam", "Yunusari", "Nguru", "Machina", "Karasuwa",
                       "Bade"],
        "Yobe East": ["Damaturu", "Gujba", "Gulani", "Tarmuwa", "Fune", "Nangere",
                      "Potiskum"],
        "Yobe South": ["Fika", "Fune", "Nangere", "Potiskum", "Damaturu", "Bursari",
                       "Jakusko", "Barde"],
    },
    "ZAMFARA": {
        "Zamfara Central": ["Bungudu", "Gusau", "Maru", "Tsafe"],
        "Zamfara North": ["Kaura Namoda", "Birnin Magaji/Kiyaw", "Shinkafi", "Zurmi"],
        "Zamfara West": ["Anka", "Bakura", "Bukkuyum", "Gummi", "Maradun", "Talata Mafara"],
    },
    "FCT": {
        "FCT": ["Abaji", "Abuja Municipal", "Bwari", "Gwagwalada", "Kuje", "Kwali"],
    },
}

# Build a reverse index: (STATE_KEY, LGA_KEY) -> district name.
_LGA_TO_DISTRICT: dict[tuple[str, str], str] = {}
for _state, _districts in _SENATORIAL.items():
    for _district, _lgas in _districts.items():
        for _lga in _lgas:
            _LGA_TO_DISTRICT.setdefault((_state, _key(_lga)), _district)


def senatorial_district(state: str, lga: str) -> str:
    """Return the senatorial district for a (state, LGA) pair, or '' if unknown."""
    sk = _key(state)
    if sk in ("ABUJA", "FEDERAL CAPITAL TERRITORY"):
        sk = "FCT"
    if sk == "FCT":
        return "FCT"
    lk = _key(lga)
    lk = _ALIASES.get(lk, lk)
    return _LGA_TO_DISTRICT.get((sk, lk), "")


# ---------------------------------------------------------------------------
# Date formatting
# ---------------------------------------------------------------------------

_MONTHS = ["", "January", "February", "March", "April", "May", "June", "July",
           "August", "September", "October", "November", "December"]


def format_long_date(value) -> str:
    """Format a date/datetime as '15 June 2005'. Blank for None/unparseable."""
    if not value:
        return ""
    if isinstance(value, datetime):
        value = value.date()
    if not isinstance(value, date):
        # Accept ISO strings too.
        try:
            value = datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            return str(value)
    return f"{value.day} {_MONTHS[value.month]} {value.year}"
