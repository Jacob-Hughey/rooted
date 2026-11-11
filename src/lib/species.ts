/**
 * A hand-picked list of common houseplants for the species picker.
 * Bundled with the app (no network), so it works offline.
 *
 * `name` is what gets saved to plants.species (botanical name, cultivar in quotes).
 * `common` is what she'll recognise; `aka` holds extra search words (old names, nicknames).
 * Within a group, the plain species comes first so it ranks first on ties.
 */
export interface Species {
  name: string;
  common: string;
  aka?: string[];
  /** Typical days between waterings indoors: a starting point, the schedule adapts from there. */
  water: number;
}

export const SPECIES: Species[] = [
  // Pothos & friends
  { name: "Epipremnum aureum", common: "Golden pothos", aka: ["devil's ivy", "pothos"], water: 7 },
  { name: "Epipremnum aureum 'Marble Queen'", common: "Marble Queen pothos", water: 7 },
  { name: "Epipremnum aureum 'Neon'", common: "Neon pothos", water: 7 },
  { name: "Epipremnum aureum 'Manjula'", common: "Manjula pothos", water: 7 },
  { name: "Epipremnum aureum 'N'Joy'", common: "N'Joy pothos", aka: ["njoy"], water: 7 },
  { name: "Epipremnum aureum 'Pearls and Jade'", common: "Pearls and Jade pothos", water: 7 },
  { name: "Epipremnum aureum 'Snow Queen'", common: "Snow Queen pothos", water: 7 },
  { name: "Epipremnum aureum 'Global Green'", common: "Global Green pothos", water: 7 },
  { name: "Epipremnum aureum 'Jessenia'", common: "Jessenia pothos", water: 7 },
  { name: "Epipremnum aureum 'Glacier'", common: "Glacier pothos", water: 7 },
  { name: "Epipremnum pinnatum 'Cebu Blue'", common: "Cebu Blue pothos", water: 7 },
  { name: "Epipremnum pinnatum", common: "Dragon tail plant", aka: ["pothos"], water: 7 },
  { name: "Scindapsus pictus 'Argyraeus'", common: "Satin pothos", aka: ["silver satin", "scindapsus"], water: 10 },
  { name: "Scindapsus pictus 'Exotica'", common: "Exotica satin pothos", water: 10 },
  { name: "Scindapsus pictus 'Silvery Ann'", common: "Silvery Ann satin pothos", water: 10 },
  { name: "Scindapsus treubii 'Moonlight'", common: "Moonlight scindapsus", aka: ["pothos"], water: 10 },

  // Philodendron
  { name: "Philodendron hederaceum", common: "Heartleaf philodendron", aka: ["sweetheart plant"], water: 7 },
  { name: "Philodendron hederaceum 'Brasil'", common: "Philodendron Brasil", water: 7 },
  { name: "Philodendron hederaceum 'Micans'", common: "Velvet philodendron", aka: ["micans"], water: 7 },
  { name: "Philodendron hederaceum 'Lemon Lime'", common: "Lemon Lime philodendron", water: 7 },
  { name: "Philodendron erubescens 'Pink Princess'", common: "Pink Princess philodendron", water: 7 },
  { name: "Philodendron 'Birkin'", common: "Philodendron Birkin", water: 7 },
  { name: "Philodendron 'Prince of Orange'", common: "Prince of Orange philodendron", water: 7 },
  { name: "Philodendron gloriosum", common: "Gloriosum philodendron", water: 7 },
  { name: "Philodendron melanochrysum", common: "Black gold philodendron", water: 7 },
  { name: "Philodendron 'Florida Ghost'", common: "Florida Ghost philodendron", water: 7 },
  { name: "Thaumatophyllum bipinnatifidum", common: "Split-leaf philodendron", aka: ["philodendron selloum", "tree philodendron"], water: 7 },
  { name: "Thaumatophyllum xanadu", common: "Philodendron Xanadu", water: 7 },

  // Monstera
  { name: "Monstera deliciosa", common: "Monstera", aka: ["swiss cheese plant", "split-leaf"], water: 7 },
  { name: "Monstera deliciosa 'Thai Constellation'", common: "Thai Constellation monstera", water: 7 },
  { name: "Monstera deliciosa 'Albo Variegata'", common: "Albo monstera", aka: ["variegated"], water: 7 },
  { name: "Monstera adansonii", common: "Swiss cheese vine", aka: ["monkey mask", "monstera"], water: 7 },
  { name: "Monstera standleyana", common: "Monstera standleyana", water: 7 },
  { name: "Rhaphidophora tetrasperma", common: "Mini monstera", aka: ["ginny"], water: 7 },

  // Ficus
  { name: "Ficus lyrata", common: "Fiddle leaf fig", water: 7 },
  { name: "Ficus lyrata 'Bambino'", common: "Dwarf fiddle leaf fig", water: 7 },
  { name: "Ficus elastica", common: "Rubber plant", aka: ["rubber tree"], water: 10 },
  { name: "Ficus elastica 'Tineke'", common: "Tineke rubber plant", water: 10 },
  { name: "Ficus elastica 'Ruby'", common: "Ruby rubber plant", water: 10 },
  { name: "Ficus elastica 'Burgundy'", common: "Burgundy rubber plant", water: 10 },
  { name: "Ficus benjamina", common: "Weeping fig", water: 7 },
  { name: "Ficus benghalensis 'Audrey'", common: "Ficus Audrey", water: 7 },
  { name: "Ficus microcarpa 'Ginseng'", common: "Ginseng ficus", aka: ["bonsai"], water: 7 },
  { name: "Ficus pumila", common: "Creeping fig", water: 4 },

  // Snake plants & ZZ
  { name: "Dracaena trifasciata", common: "Snake plant", aka: ["sansevieria", "mother-in-law's tongue"], water: 14 },
  { name: "Dracaena trifasciata 'Laurentii'", common: "Laurentii snake plant", aka: ["sansevieria"], water: 14 },
  { name: "Dracaena trifasciata 'Hahnii'", common: "Bird's nest snake plant", aka: ["sansevieria"], water: 14 },
  { name: "Dracaena trifasciata 'Moonshine'", common: "Moonshine snake plant", aka: ["sansevieria"], water: 14 },
  { name: "Dracaena angolensis", common: "Cylindrical snake plant", aka: ["sansevieria cylindrica"], water: 21 },
  { name: "Zamioculcas zamiifolia", common: "ZZ plant", aka: ["zanzibar gem"], water: 14 },
  { name: "Zamioculcas zamiifolia 'Raven'", common: "Raven ZZ plant", water: 14 },

  // Dracaena
  { name: "Dracaena marginata", common: "Dragon tree", water: 10 },
  { name: "Dracaena fragrans", common: "Corn plant", water: 10 },
  { name: "Dracaena fragrans 'Janet Craig'", common: "Janet Craig dracaena", water: 10 },
  { name: "Dracaena reflexa 'Song of India'", common: "Song of India", water: 10 },

  // Prayer plants
  { name: "Goeppertia orbifolia", common: "Calathea orbifolia", water: 4 },
  { name: "Goeppertia makoyana", common: "Peacock plant", aka: ["calathea"], water: 4 },
  { name: "Goeppertia insignis", common: "Rattlesnake plant", aka: ["calathea lancifolia"], water: 4 },
  { name: "Goeppertia roseopicta 'Medallion'", common: "Calathea Medallion", water: 4 },
  { name: "Goeppertia 'White Fusion'", common: "Calathea White Fusion", water: 4 },
  { name: "Goeppertia kegeljanii 'Network'", common: "Calathea Network", aka: ["musaica"], water: 4 },
  { name: "Maranta leuconeura 'Erythroneura'", common: "Red prayer plant", aka: ["maranta"], water: 5 },
  { name: "Maranta leuconeura 'Kerchoveana'", common: "Green prayer plant", aka: ["rabbit's foot", "maranta"], water: 5 },
  { name: "Stromanthe sanguinea 'Triostar'", common: "Stromanthe Triostar", water: 5 },
  { name: "Ctenanthe burle-marxii", common: "Fishbone prayer plant", aka: ["ctenanthe"], water: 5 },

  // Aroids
  { name: "Alocasia × amazonica 'Polly'", common: "Alocasia Polly", aka: ["african mask", "elephant ear"], water: 5 },
  { name: "Alocasia zebrina", common: "Alocasia zebrina", aka: ["elephant ear"], water: 5 },
  { name: "Alocasia micholitziana 'Frydek'", common: "Alocasia Frydek", aka: ["green velvet", "elephant ear"], water: 5 },
  { name: "Alocasia reginula 'Black Velvet'", common: "Alocasia Black Velvet", aka: ["elephant ear"], water: 5 },
  { name: "Alocasia baginda 'Dragon Scale'", common: "Alocasia Dragon Scale", aka: ["elephant ear"], water: 5 },
  { name: "Anthurium andraeanum", common: "Anthurium", aka: ["flamingo flower"], water: 7 },
  { name: "Anthurium clarinervium", common: "Velvet cardboard anthurium", water: 7 },
  { name: "Spathiphyllum wallisii", common: "Peace lily", water: 5 },
  { name: "Aglaonema commutatum 'Silver Bay'", common: "Silver Bay Chinese evergreen", aka: ["aglaonema"], water: 10 },
  { name: "Aglaonema 'Siam Aurora'", common: "Red Chinese evergreen", aka: ["aglaonema"], water: 10 },
  { name: "Dieffenbachia seguine", common: "Dumb cane", aka: ["dieffenbachia"], water: 7 },
  { name: "Syngonium podophyllum", common: "Arrowhead plant", aka: ["syngonium"], water: 7 },
  { name: "Syngonium podophyllum 'Neon Robusta'", common: "Pink arrowhead plant", aka: ["syngonium"], water: 7 },
  { name: "Syngonium podophyllum 'Albo Variegatum'", common: "Albo arrowhead plant", aka: ["syngonium"], water: 7 },

  // Trailing & hanging
  { name: "Chlorophytum comosum", common: "Spider plant", water: 7 },
  { name: "Chlorophytum comosum 'Vittatum'", common: "Variegated spider plant", water: 7 },
  { name: "Chlorophytum comosum 'Bonnie'", common: "Curly spider plant", water: 7 },
  { name: "Ceropegia woodii", common: "String of hearts", water: 14 },
  { name: "Curio rowleyanus", common: "String of pearls", aka: ["senecio"], water: 14 },
  { name: "Curio radicans", common: "String of bananas", aka: ["senecio"], water: 14 },
  { name: "Peperomia prostrata", common: "String of turtles", water: 10 },
  { name: "Hedera helix", common: "English ivy", water: 5 },
  { name: "Cissus rhombifolia", common: "Grape ivy", water: 7 },
  { name: "Tradescantia zebrina", common: "Wandering dude", aka: ["inch plant", "wandering jew"], water: 5 },
  { name: "Tradescantia fluminensis", common: "Small-leaf spiderwort", aka: ["tradescantia"], water: 5 },
  { name: "Tradescantia albiflora 'Nanouk'", common: "Tradescantia Nanouk", water: 7 },
  { name: "Tradescantia pallida", common: "Purple heart", aka: ["tradescantia"], water: 10 },
  { name: "Dischidia nummularia", common: "String of nickels", water: 7 },

  // Hoya
  { name: "Hoya carnosa", common: "Wax plant", aka: ["hoya"], water: 10 },
  { name: "Hoya carnosa 'Krimson Queen'", common: "Hoya Krimson Queen", aka: ["tricolor"], water: 10 },
  { name: "Hoya carnosa 'Krimson Princess'", common: "Hoya Krimson Princess", water: 10 },
  { name: "Hoya kerrii", common: "Sweetheart hoya", aka: ["valentine"], water: 10 },
  { name: "Hoya pubicalyx", common: "Hoya pubicalyx", water: 10 },
  { name: "Hoya linearis", common: "Hoya linearis", water: 7 },
  { name: "Hoya australis", common: "Hoya australis", water: 10 },

  // Peperomia & pilea
  { name: "Pilea peperomioides", common: "Chinese money plant", aka: ["pilea", "pancake plant", "ufo plant"], water: 7 },
  { name: "Peperomia obtusifolia", common: "Baby rubber plant", aka: ["peperomia"], water: 10 },
  { name: "Peperomia argyreia", common: "Watermelon peperomia", water: 7 },
  { name: "Peperomia caperata", common: "Ripple peperomia", water: 10 },
  { name: "Peperomia tetraphylla 'Hope'", common: "Peperomia Hope", water: 10 },

  // Small foliage
  { name: "Fittonia albivenis", common: "Nerve plant", aka: ["fittonia"], water: 4 },
  { name: "Hypoestes phyllostachya", common: "Polka dot plant", water: 4 },
  { name: "Begonia maculata", common: "Polka dot begonia", water: 7 },
  { name: "Begonia rex-cultorum", common: "Rex begonia", water: 7 },
  { name: "Oxalis triangularis", common: "Purple shamrock", aka: ["oxalis", "false shamrock"], water: 7 },
  { name: "Codiaeum variegatum", common: "Croton", water: 5 },

  // Ferns
  { name: "Nephrolepis exaltata", common: "Boston fern", water: 4 },
  { name: "Asplenium nidus", common: "Bird's nest fern", water: 7 },
  { name: "Adiantum raddianum", common: "Maidenhair fern", water: 3 },
  { name: "Platycerium bifurcatum", common: "Staghorn fern", water: 7 },
  { name: "Phlebodium aureum", common: "Blue star fern", water: 7 },
  { name: "Davallia fejeensis", common: "Rabbit's foot fern", water: 5 },
  { name: "Asparagus setaceus", common: "Asparagus fern", water: 5 },

  // Palms & trees
  { name: "Dypsis lutescens", common: "Areca palm", water: 7 },
  { name: "Chamaedorea elegans", common: "Parlor palm", water: 7 },
  { name: "Howea forsteriana", common: "Kentia palm", water: 10 },
  { name: "Rhapis excelsa", common: "Lady palm", water: 10 },
  { name: "Beaucarnea recurvata", common: "Ponytail palm", water: 21 },
  { name: "Strelitzia reginae", common: "Bird of paradise", water: 7 },
  { name: "Strelitzia nicolai", common: "White bird of paradise", water: 7 },
  { name: "Schefflera arboricola", common: "Dwarf umbrella tree", aka: ["schefflera"], water: 10 },
  { name: "Pachira aquatica", common: "Money tree", water: 10 },
  { name: "Coffea arabica", common: "Coffee plant", water: 5 },
  { name: "Citrus × meyeri", common: "Meyer lemon", water: 7 },

  // Succulents & cacti
  { name: "Crassula ovata", common: "Jade plant", water: 14 },
  { name: "Aloe vera", common: "Aloe vera", water: 21 },
  { name: "Haworthiopsis attenuata", common: "Zebra plant", aka: ["haworthia"], water: 21 },
  { name: "Echeveria elegans", common: "Mexican snowball", aka: ["echeveria"], water: 14 },
  { name: "Sedum morganianum", common: "Burro's tail", aka: ["donkey tail"], water: 14 },
  { name: "Euphorbia trigona", common: "African milk tree", water: 21 },
  { name: "Euphorbia milii", common: "Crown of thorns", water: 14 },
  { name: "Kalanchoe blossfeldiana", common: "Flaming Katy", aka: ["kalanchoe"], water: 10 },
  { name: "Schlumbergera × buckleyi", common: "Christmas cactus", aka: ["holiday cactus"], water: 10 },
  { name: "Schlumbergera truncata", common: "Thanksgiving cactus", aka: ["holiday cactus"], water: 10 },
  { name: "Mammillaria", common: "Pincushion cactus", water: 21 },
  { name: "Lithops", common: "Living stones", water: 30 },

  // Flowering & others
  { name: "Phalaenopsis", common: "Moth orchid", aka: ["orchid"], water: 7 },
  { name: "Saintpaulia ionantha", common: "African violet", water: 7 },
  { name: "Guzmania lingulata", common: "Guzmania bromeliad", aka: ["bromeliad"], water: 7 },
  { name: "Tillandsia", common: "Air plant", water: 7 },
  { name: "Cyclamen persicum", common: "Florist's cyclamen", aka: ["cyclamen"], water: 5 },
];

const BY_NAME = new Map<string, Species>();

/** The list entry whose botanical name matches what's in the field (typed or picked), if any. */
export function findSpecies(name: string): Species | undefined {
  return BY_NAME.get(normalize(name));
}

/** Lowercase, drop accents, quotes and the hybrid ×, so "njoy" finds "N'Joy". */
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’"×]/g, "")
    .replace(/[-\s]+/g, " ")
    .trim();
}

for (const s of SPECIES) BY_NAME.set(normalize(s.name), s);

const INDEX = SPECIES.map((s, i) => {
  const common = normalize(s.common);
  const all = [common, normalize(s.name), ...(s.aka ?? []).map(normalize)].join(" | ");
  return { s, i, common, all, words: all.split(/[\s|]+/) };
});

/**
 * Every word she types must appear somewhere (common name, botanical name or aka).
 * Names starting with what she typed rank first, then word-starts, then anything else.
 */
export function searchSpecies(query: string, limit = 30): Species[] {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(" ");
  return INDEX.filter((e) => tokens.every((t) => e.all.includes(t)))
    .map((e) => {
      const rank = e.common.startsWith(q) ? 0 : tokens.every((t) => e.words.some((w) => w.startsWith(t))) ? 1 : 2;
      return { e, rank };
    })
    .sort((a, b) => a.rank - b.rank || a.e.i - b.e.i)
    .slice(0, limit)
    .map(({ e }) => e.s);
}
