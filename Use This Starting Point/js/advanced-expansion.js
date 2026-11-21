(function () {
    'use strict';

    const modes = {
        receive: [['receive', 'Receive', 'Receiving or experiencing: '], ['give', 'Give', 'Giving or initiating: ']],
        wear: [['self', 'I wear', 'Wearing this myself: '], ['partner', 'They wear', 'My partner wearing: ']],
        use: [['self', 'On me', 'My interest in this on me: '], ['partner', 'On partner', 'My interest in this on my partner: ']],
        restrain: [['self', 'On me', 'Being restrained with: '], ['partner', 'On partner', 'Restraining my partner with: ']],
        roles: [['self', 'My role', 'My interest in taking this role: '], ['partner', 'Partner role', 'My interest in a partner taking this role: ']],
        dynamic: [['lead', 'I lead', 'My interest in initiating this dynamic: '], ['follow', 'They lead', 'My interest in my partner initiating this dynamic: ']],
    };
    const singlePrompts = {
        shared: 'My interest in: ',
        partner: 'My preference in a partner: ',
        age: 'Dating a partner in this adult age range: ',
        platform: 'Keeping in touch with a partner using: ',
    };
    const semenSource = [
        { exclude: { partnerGender: "female" } },
        { exclude: { selfGender: "female" } },
    ];
    const lactationOrMenstrualSource = [
        { exclude: { partnerGender: "male" } },
        { exclude: { selfGender: "male" } },
    ];
    const partnerHasPenis = { partnerAnatomy: "penis" };

    function section(id, title, group, mode, entries, {
        fantasy = false, anatomy = {}, mutualAnatomy = {}, partnerGenders = {},
        choiceRequirements = {}, defaultChoiceRequirements = [],
    } = {}) {
        const directions = modes[mode];
        const topics = entries.map(([key, label, fictional = fantasy, wording = {}]) => {
            const id = 'adv-detail-' + key;
            const ratings = directions
                ? directions.map(([suffix, short, prefix]) => [id + '-' + suffix, prefix + label, short])
                : [[id, singlePrompts[mode] + label]];
            const displayTitle = wording.title ?? label;
            const entry = fictional ? fantasyTopic(displayTitle, ...ratings) : topic(displayTitle, ...ratings);
            wording.choices?.forEach(([short, prompt], index) => {
                const choice = entry.choices[index];
                choice.legacyPrompt = choice.prompt;
                choice.short = short;
                choice.prompt = prompt;
            });
            const body = anatomy[key];
            if (body) {
                if (mode === 'partner') entry.choices[0].requirements = { partnerAnatomy: body };
                else {
                    entry.choices[0].requirements = { selfAnatomy: body };
                    entry.choices[1].requirements = { partnerAnatomy: body };
                }
            }
            const mutual = mutualAnatomy[key];
            if (mutual) {
                for (const choice of entry.choices) choice.requirements = { selfAnatomy: mutual, partnerAnatomy: mutual };
            }
            const gender = partnerGenders[key];
            if (gender) entry.choices[0].requirements = { ...entry.choices[0].requirements, partnerGender: gender };
            (choiceRequirements[key] ?? defaultChoiceRequirements).forEach((requirements, index) => {
                const choice = entry.choices[index];
                choice.requirements = { ...choice.requirements, ...requirements };
            });
            return entry;
        });
        return { id: 'advanced-' + id, title, group, advanced: true, topics, directions: directions?.map(([, short]) => short) };
    }

    DBList.categories.push(
        section("role-styles", "Dominant and submissive styles", "self", "roles", [
            ["as-hard-dominant", "Firm Dominance"],
            ["as-tradwife-homemaker", "Homemaker Role"],
        ]),
        section("discipline", "Service and scene structure", "self", "dynamic", [
            ["begging", "Begging"],
            ["orgasm-denial", "Orgasm denial"],
            ["overstimulation", "Overstimulation"],
            ["pet-play", "General Pet Play"],
            ["pup-play", "Pup play"],
            ["pony-play", "Pony play"],
        ]),
        section("closeness", "Affection and non-sexual touch", "self", "receive", [
            ["hugging", "Hugging"],
            ["bear-hugs", "Bear Hugs"],
            ["kissing-mouth", "Kissing (mouth)"],
            ["kissing-body", "Kissing (body)"],
            ["french-kissing", "French Kissing"],
            ["sloppy-kisses", "Sloppy Kisses"],
            ["hickies", "Hickeys"],
            ["spooning", "Spooning"],
            ["headpats", "Headpats"],
        ]),
        section("common-touch", "Intimate touch", "self", "receive", [
            ["strip-tease", "Striptease"],
            ["sex-toy-stimulation", "Stimulation (Sex Toy)"],
            ["blowjob", "Oral Stimulation (Penis)"],
            ["deep-throat", "Deep-throat Oral"],
            ["facials", "Semen on Face"],
            ["cunnilingus", "Cunnilingus"],
            ["rimming", "Rimming"],
        ], {
            anatomy: { blowjob: "penis", "deep-throat": "penis", cunnilingus: "vulva" },
            choiceRequirements: { facials: semenSource },
        }),
        section("intimate-contexts", "Intimacy preferences", "self", "shared", [
            ["loud-sex", "Loud sex"],
            ["quiet-silent-sex", "Quiet / Silent sex"],
            ["condoms", "Using Condoms"],
            ["barebacking", "Sex Without Condoms"],
            ["multiple-orgasms-marathon-sex", "Multiple Orgasms / Long Sessions"],
            ["premature-ejaculation", "Premature Ejaculation"],
        ]),
        section("penis-preferences", "Penis-focused preferences", "self", "use", [
            ["cockring", "Cockring"],
            ["thighjob", "Thighjob"],
            ["docking", "Docking"],
        ], {
            anatomy: { cockring: "penis", thighjob: "penis" },
            mutualAnatomy: { docking: "penis" },
        }),
        section("vulva-preferences", "Vulva-focused preferences", "self", "use", [
            ["fisting", "Vaginal Fisting"],
            ["double-penetration", "Double Penetration", undefined, {
                title: "Vaginal Double Penetration",
                choices: [
                    ["On me", "Double penetration involving my vagina"],
                    ["On partner", "Double penetration involving my partner’s vagina"],
                ],
            }],
            ["clit-stimulation", "Clitoral Stimulation"],
            ["squirting", "Squirting"],
            ["tribadism-scissoring", "Tribadism / Scissoring", undefined, {
                title: "Tribadism / Scissoring (Vulva-to-Vulva)",
                choices: [
                    ["On me", "I receive vulva-to-vulva stimulation"],
                    ["On partner", "My partner receives vulva-to-vulva stimulation"],
                ],
            }],
            ["vaginal-stretching", "Vaginal Stretching"],
            ["object-insertion", "Vaginal Object Insertion"],
            ["pussy-play-worship", "Vulva Worship"],
        ], {
            anatomy: {
                fisting: "vulva", "double-penetration": "vulva", "clit-stimulation": "vulva", squirting: "vulva",
                "vaginal-stretching": "vulva", "object-insertion": "vulva", "pussy-play-worship": "vulva",
            },
            mutualAnatomy: { "tribadism-scissoring": "vulva" },
        }),
        section("positions", "Positions", "self", "shared", [
            ["missionary", "Missionary"],
            ["69", "Mutual Oral (69)"],
            ["cowgirl", "Cowgirl"],
            ["reverse-cowgirl", "Reverse-Cowgirl"],
            ["up-against-walls", "Against a Wall"],
            ["mating-press", "Mating Press"],
            ["prone-bone", "Face-down Position"],
            ["sex-swing", "Sex Swing"],
        ]),
        section("anal-preferences", "Anal preferences", "self", "receive", [
            ["ass-play-worship", "Butt Worship"],
            ["anal-fisting", "Anal Fisting"],
            ["enemas", "Enemas"],
        ]),
        section("group-settings", "Partner and group settings", "relationship", "shared", [
            ["you-with-1-male", "One Male Partner"],
            ["you-with-1-female", "One Female Partner"],
            ["you-with-1-male-1-female", "One Male and One Female Partner"],
            ["you-with-2-males", "Two or More Male Partners"],
            ["you-with-2-females", "Two or More Female Partners"],
            ["orgy-4-people", "Group of Four or More"],
        ], { partnerGenders: {
            "you-with-1-male": "male", "you-with-2-males": "male",
            "you-with-1-female": "female", "you-with-2-females": "female",
            "you-with-1-male-1-female": "mixed",
        } }),
        section("wardrobe", "Clothing and accessories", "self", "wear", [
            ["formal-business-attire", "Formal / Business Attire"],
            ["masks", "Masks"],
            ["choker", "Choker"],
            ["corset", "Corset"],
            ["underwear", "Underwear"],
            ["spandex", "Spandex"],
            ["uniform-costume", "Uniform / Costume"],
            ["gloves", "Gloves"],
            ["socks", "Socks"],
            ["fishnets", "Fishnets"],
            ["garterbelt", "Garter Belt"],
        ]),
        section("presentation", "Presentation and styling", "self", "shared", [
            ["clothed-sex", "Staying Clothed During Sex"],
            ["cross-dressing", "Cross-dressing"],
        ]),
        section("restraint-types", "Bondage and restraint types", "self", "restrain", [
            ["bondage-light", "Light Restraint"],
            ["bondage-heavy", "Restrictive Bondage"],
            ["ball-gag", "Ball Gag"],
            ["ring-gag", "Ring Gag"],
            ["bit-gag", "Bit Gag"],
            ["rope-play", "General Rope Play"],
            ["cages", "Cages"],
            ["immobilization", "Immobilization"],
            ["spread-bars", "Spreader Bars"],
            ["monoglove-armbinder", "Armbinder"],
        ]),
        section("toy-types", "Toy types", "self", "use", [
            ["dildos", "Dildos"],
            ["realistic-dildos", "Realistic Dildos"],
            ["other-fantasy-dildos", "Fantasy Dildos"],
            ["sybians", "Ride-on Vibrators"],
            ["sex-machines", "Sex machines"],
            ["nipple-sucker", "Nipple sucker"],
            ["cock-pussy-pump", "Genital Pumps"],
            ["inflatable-toys", "Inflatable toys"],
        ]),
        section("sensory-details", "Specific sensations", "self", "receive", [
            ["licking", "Licking"],
            ["breast-play-worship", "Breast play / worship"],
            ["nipple-play", "Nipple play"],
            ["navel-play", "Navel play"],
            ["food-play", "Food play"],
            ["sensory-deprivation", "Sensory deprivation"],
        ]),
        section("impact-types", "Impact and pressure", "self", "receive", [
            ["light-pain", "Light Pain"],
            ["heavy-pain", "Heavy Pain"],
            ["nipple-clamps", "Nipple clamps"],
            ["clothes-pins", "Clothes pins"],
            ["face-slapping", "Face slapping"],
            ["body-slapping", "Body slapping"],
            ["caning", "Caning"],
            ["whipping", "Whipping"],
            ["scratching", "Scratching"],
            ["bruising-short-lasting", "Temporary Bruising"],
        ]),
        section("scene-language", "Degradation and scene language", "self", "dynamic", [
            ["spitting", "Spitting (Degradation)"],
            ["forced-nudity", "Negotiated Nudity Roleplay", true],
            ["cock-play-worship", "Penis Worship"],
            ["name-calling", "Name calling"],
            ["objectification", "Objectification"],
            ["human-furniture", "Human Furniture"],
            ["public-humiliation", "Public Humiliation Roleplay", true],
            ["body-writing", "Body Writing"],
            ["competition", "Competitive Play"],
        ], { choiceRequirements: { "cock-play-worship": [partnerHasPenis, partnerHasPenis] } }),
        section("body-senses", "Body and sensory interests", "self", "shared", [
            ["shaving", "Shaving"],
            ["crotch-sniffing", "Intimate Scent"],
            ["ear-play", "Ear Play"],
            ["foreskin-worship", "Foreskin Worship", undefined, {
                choices: [["My partner’s foreskin", "I worship my partner’s foreskin"]],
            }],
            ["muscle-worship", "Muscle worship"],
            ["scent-musk", "Body Scent"],
            ["queefing", "Queefing"],
            ["farting", "Farting"],
            ["armpits", "Armpits"],
            ["used-underwear", "Used Underwear"],
            ["oiled", "Body Oil"],
            ["breast-pumps", "Breast Pumps"],
        ], { choiceRequirements: { "foreskin-worship": [partnerHasPenis] } }),
        section("bodily-fluids", "Body-fluid preferences", "self", "receive", [
            ["saliva-spit", "Saliva / Spit"],
            ["cum-play", "Semen-related Interests"],
            ["watersports", "Urine-related Interests"],
            ["scat", "Feces-related Interests"],
            ["lactation", "Lactation"],
            ["sweat", "Sweat"],
            ["marking", "Marking"],
            ["wetting", "Wetting"],
            ["menses", "Menstrual Fluid"],
        ], {
            choiceRequirements: { "cum-play": semenSource, lactation: lactationOrMenstrualSource, menses: lactationOrMenstrualSource },
        }),
        section("placement", "Fluid placement and sharing", "self", "receive", [
            ["cum-on-back-butt", "Semen on Back or Buttocks"],
            ["cum-on-stomach-genitals", "Semen on Abdomen or Genitals"],
            ["cum-on-breasts", "Semen on Chest"],
            ["bukkake", "Bukkake"],
            ["creampie", "Creampie"],
            ["anal-creampie", "Anal Creampie"],
            ["cum-swapping", "Semen Swapping"],
            ["cum-eating", "Swallowing Semen", undefined, {
                choices: [
                    ["I swallow", "I swallow my partner’s semen"],
                    ["Partner swallows", "My partner swallows my semen"],
                ],
            }],
            ["cum-bath", "Semen Bath Fantasy", true],
            ["cum-marking", "Semen Marking"],
            ["cum-on-clothes", "Semen on Clothing"],
        ], { defaultChoiceRequirements: semenSource }),
        section("fluid-fantasies", "Fluid-related preferences", "self", "shared", [
            ["realistic-cum", "Realistic Semen (Fiction)", true],
            ["shooting-precum", "Projected Pre-ejaculate (Fiction)", true],
            ["stomach-bulging", "Belly Bulging (Fiction)", true],
        ]),
        section("scene-settings", "Specific roleplay settings", "self", "shared", [
            ["medical", "Medical Roleplay"],
            ["workplace", "Workplace Roleplay"],
            ["maid", "Maid or Housekeeper Roleplay"],
            ["prostitution", "Fictional Paid Encounter"],
            ["military-war", "Military-themed Fiction"],
            ["hypnosis", "Hypnosis Roleplay"],
            ["celebrity", "Celebrity"],
        ], { fantasy: true }),
        section("adult-media", "Adult media and aesthetics", "self", "shared", [
            ["shooting-porn", "Making Adult Videos"],
            ["mirror-sex", "Mirror Sex"],
        ]),
        section("fantasy-worlds", "Fantasy worlds and characters", "self", "shared", [
            ["hentai", "Adult Animation"],
            ["hentai-manga", "Adult Manga"],
            ["eroge", "Adult Visual Novels"],
            ["furry", "Adult Furry Fiction"],
            ["futanari-futa", "Adult Futanari Fiction"],
            ["tentacles", "Tentacles"],
            ["alien", "Alien"],
            ["ghost", "Ghost"],
            ["scalies", "Reptilian Fantasy Characters"],
            ["magic-users", "Magic Users"],
            ["macrophilia", "Giant Characters"],
            ["microphilia", "Tiny Characters"],
        ], { fantasy: true }),
        section("fantasy-changes", "Fantasy transformations", "self", "shared", [
            ["breast-growth", "Breast Growth"],
            ["cock-ball-growth", "Cock / Ball Growth"],
            ["cum-inflation", "Semen Inflation Fantasy"],
            ["growth", "Growth"],
            ["male-pregnancy", "Male Pregnancy"],
            ["oviposition", "Oviposition"],
            ["shrinking", "Shrinking"],
            ["gender-change", "Gender Transformation (Fiction)"],
        ], { fantasy: true }),
        section("build", "Build and stature", "partner", "partner", [
            ["normal", "Average Build"],
            ["full-figured", "Fuller Build"],
            ["skinny", "Very Lean Build"],
            ["curvy", "Curvy"],
            ["muscular", "Muscular"],
            ["tall", "Taller Than Me"],
            ["short", "Short Stature"],
            ["tanned", "Tanned"],
            ["pale", "Pale"],
            ["freckles", "Freckles"],
        ]),
        section("hair", "Hair and grooming", "partner", "partner", [
            ["bald-hair", "Bald"],
            ["short-hair", "Short Hair"],
            ["long-hair", "Long Hair"],
            ["very-long-hair", "Very Long Hair"],
            ["redhead", "Redhead"],
            ["dyed-hair-unnatural-colors", "Dyed Hair (unnatural colors)"],
            ["light-beard", "Light Beard"],
            ["full-beard", "Full Beard"],
            ["some-body-hair", "Some Body Hair"],
            ["shaved-body", "Shaved Body"],
            ["hairy-crotch", "Natural Pubic Hair"],
            ["trimmed-crotch", "Trimmed Pubic Hair"],
        ], { partnerGenders: { "light-beard": "male", "full-beard": "male" } }),
        section("features", "Features and adornment", "partner", "partner", [
            ["small-breasts", "Smaller Breasts"],
            ["large-breasts", "Larger Breasts"],
            ["small-cocks", "Smaller Penises"],
            ["large-cocks", "Larger Penises"],
            ["genital-piercings", "Genital Piercings"],
            ["nipple-piercings", "Nipple Piercings"],
            ["nonsexual-piercings", "Non-genital Piercings"],
            ["tattoos", "Tattoos"],
            ["body-covering-tattoos", "Body-covering Tattoos"],
        ], { anatomy: { "small-cocks": "penis", "large-cocks": "penis" } }),
        section("adult-ages", "Adult age ranges", "partner", "age", [
            ["18-22", "18 - 22"],
            ["22-26", "22 - 26"],
            ["26-30", "26 - 30"],
            ["30-35", "30 - 35"],
            ["35-40", "35 - 40"],
            ["40-50", "40 - 50"],
            ["50-60", "50 - 60"],
            ["60", "60 +"],
        ]),
        section("partner-fit", "Partner habits and traits", "partner", "partner", [
            ["tobacco-use", "Tobacco Use"],
            ["cannabis-use", "Cannabis Use"],
            ["alcohol-use", "Alcohol Use"],
            ["intelligent-partners", "Intellectual Compatibility"],
            ["mtf-trans", "Trans Women"],
            ["ftm-trans", "Trans Men"],
        ], { partnerGenders: { "mtf-trans": "female", "ftm-trans": "male" } }),
        section("connections", "Ways to connect", "relationship", "shared", [
            ["no-strings-attached-nsa", "No-strings Encounters"],
        ]),
        section("roles-with-others", "Partner-sharing roles", "relationship", "shared", [
            ["as-cuckold-cuckquean", "Cuckold / Cuckquean Role"],
            ["as-hotwife-hothusband", "Hotwife / Hothusband Role"],
            ["as-bull-cuckcake", "Third-partner Role"],
        ]),
        section("communication-channels", "Communication preferences", "relationship", "shared", [
            ["in-person", "In-person Communication"],
            ["texting", "Text Messaging"],
            ["voice-calls", "Voice calls"],
            ["video-calls", "Video calls"],
            ["pet-names", "Pet names"],
        ]),
        section("apps", "Messaging platforms", "relationship", "platform", [
            ["reddit", "Reddit"],
            ["discord", "Discord"],
            ["whatsapp", "WhatsApp"],
            ["facebook-messenger", "Facebook Messenger"],
            ["instagram", "Instagram"],
            ["telegram", "Telegram"],
            ["snapchat", "Snapchat"],
            ["signal", "Signal"],
            ["other", "Other Messaging Apps"],
        ]),
    );
})();
