(function () {
    'use strict';

    const { categories, compactShareRoute, readChecklist, readProfilePatch } = DBList;
    const legacyPrefix = '#list=';
    const compactPrefix = compactShareRoute.prefix;
    // The first base64 digit carries two version bits and four flags.
    // Only links with extra ratings or profile details need the two 16-bit length/count fields.
    const extendedHeaderBytes = 4;
    const checksumBytes = 4;
    const extraRatingBytes = 9;
    const maxPayloadBytes = 12_000;
    const legacySparseFlag = 0x8000;
    const sparseFlag = 4;
    const extendedFlag = 8;
    const compactVersionMask = 0x30;
    const ratings = ['', 'favorite', 'like', 'maybe', 'not-interested', 'limit', 'willing-to-try'];
    // Rating codes are fixed on the wire. The expanded format adds code 6 and packs two digits per byte.
    const originalFormat = { version: 0, base: 6, perByte: 3 };
    const expandedFormat = { version: 0x10, base: 7, perByte: 2 };
    const publicFields = ['name', 'role', 'age'];
    const encoder = new TextEncoder();

    function fingerprint(bytes) {
        let hash = 0xcbf29ce484222325n;
        for (const byte of bytes) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
        return hash;
    }

    // Changed question meanings get distinct fingerprints.
    const choices = categories.flatMap(({ group, advanced, topics }) => topics.flatMap(({ fantasy, choices }) =>
        choices.map(({ id, prompt }) => ({
            id, advanced, fantasy, key: fingerprint(encoder.encode(JSON.stringify([id, group, prompt]))),
        }))));
    const choicesByKey = new Map(choices.map(choice => [choice.key, choice.id]));
    if (choicesByKey.size !== choices.length) throw new Error('Duplicate choice fingerprints in the checklist catalog.');

    // This is the permanent wire order for v1. New or revised choices travel as extra fingerprints.
    const catalogV1 = `
        d86df072657c5199 eba041dcf2292c84 1ead0a66ee68c9f8 8cadaf5bd6e0065c 46409291f6e2d8c7
        6782869e6dadd36e 6fe141b613f4e329 29fe3a963e9d46b8 d71739c7b1805849 4c4c538dcf894941
        e952aa9724285dc6 a7d4e2698515f35b c224e6d7e354a7df b7b70c902ffe2f62 a9320412d9991ab3
        f9c716de97bcadef c5d1d9f585d45462 46084a74eaf0e5e1 fe66a7469618003b 78efc389d320701b
        4f12e1d3817184c5 582a7222dc0a4a1b 58f13ee08f1cbac8 bf50a796e4975b39 b88981729fca0f9e
        86b002c857c0f399 dd61d609d3b0f8e6 c1e6e31058291315 a9d9eb22f103368f f22b44cfa4f52bfd
        90a73d5229360321 c24ff10266328b76 f388d68645f0b0df 09c8bf27046933e2 b5a3dcbe702dd36a
        ee39073ac767ef49 a4f2c6e2b5ff1937 a5a5a09e3a0e92f5 b1f91379cc6d6411 08bee6be96076891
        923fdfada091ea80 fdf0afe369f13dc1 5e6b583f8e21edf9 65964887cebadb26 eff4ae485e8459de
        932db6f3537647a1 d2882d1ac5d294e0 5b6a13bb5c9cfc83 317c298d7454b168 381cafa21f44635f
        a2729c4bafe6472b 32e2d2b709f35d3c 4951be1806621c23 f90972642867804a 053cd41b09ba6204
        11e9291d6806d3c7 af7bd6e30a71cf16 2c5f213d6954ef0f 09c8df5e7965be52 8e247320df3292fb
        801c4b3dc98e2ffe 188e4b7fcadf323b b607f6575a0d6ea6 6b0e08f8bc7ca293 dcaecb5ddcd67b79
        d064ad22c8e7ad08 29e191e49f7b4c50 78a3a95a2f9166e7 7a5092e9d4ee369e f53cc483fa1ab21d
        a3a2c7ff3ba7ef57 68c49fa2be972bdd 99e839b90085d530 c9898aa0a41e373c 87fcc9dca52409e0
        e0a05d452953631e 88290708d6b68d18 144ecf08e42065ef 69aca516428c4390 b7aa3b955fa80a79
        bd841e5385658016 98854d087aedda18 5feb63cdf3e80080 9c8d0dd5b19e42a3 58095eb11d5f232a
        3a7ea09f44df9af7 29894712d85076ed 422ec4bd0af1daa6 9061124b0b235bf0 01b57d7d2f85e6c9
        bed80731821a88f6 2b91eb930e3a2cf5 565b71ef2a19257d 57b35ae7d0a4d270 3fd737c3113d83dd
        cb66c2a72ec1651a e5ba8208e970260a 8894991f7af2eedb 476d9c80c3317e55 7a83cc188fdfe34c
        972fe4c3bbdaa098 6ecf967e7912fcc6 47860b7950dd8841 dfaf4f2042576dbd 42e9127e65abf4a3
        024249fc227564d2 dd4941b19af48f13 288ab431724a68c4 cc4f3699c0608472 57e31c766043fa45
        556a428e34c2ae12 5424ee9e260e43f6 d54b3b37249bd46d bc65617b047c5e44 be49eecbdd7b5bf5
        096a727015c8144a eb27cdfa0c1e3a17 f2ca830fcbf981cc 565b53a56205aec4 e1a5719de8090895
        97e9b963a3a36e9b 854d6d7fc358eb26 8115bb6f307596d6 6a003067a822cb0d 5e045b8df4094b17
        3afa55f762d89f2c 9822a2fdb5f0f92f 07dc6220f226d2d0 e842d2e52732814a 66f04338c2207818
        026bb14dc773826a 2d34774afafb0719 a4844fcbe198f45e 278f10328b1e93b5 106fc66faafd9ced
        ab966ab740243aeb 5eb67039e3c7bea1 0a6ccc341582e9ef a72f9ebbf5ee8780 bb2fadc3849bf2e7
        716a98cfbf6bc145 2d7ff67a045cab49 98fa6133eb7da43c f65cb81ffb5568ea b05f8a4daca2e292
        9d4b08f01d061f6c 1997f8931f9dd983 aeb5699b9e968283 9262a5e18c9069f5 203499140f596677
        59477c0fcc0e23e9 acc5a57a688737a9 096d30fc96407947 d139dc925395d8de a286da7c93b5df5b
        5f7345a71bb4eed5 821c8cae65dd36bc 8eae5207d062a1b3 97834ed89098107e f94e6ff0e28ad971
        070e978609b88c2a 0b8788cdda1b7a0d 502f84f9426d9009 d6224f80381f2dc6 861e687f8d9b45b9
        f7650d03cc464346 4595ce93822bf7fc fbc28e6d1124fd89 9116ca2ba7b07a8b 863c6f07b063f866
        18b62a5a36ddc33c f0afbc3df5824771 9b068f33662c0c23 db0e92a2e82d7f56 fafc91ba30508d4d
        6755edc51169684c a136737aa9e54e21 a55175bc43c298e4 1c8bed7fbe416093 914eb8a29e10a9de
        871f10af8630634f d971e4e523df3410 3a69f9916480c400 f89eb7f0e64cd30b 46575bc5995e3a73
        db6a9366956caeb8 b65450b31d179209 d0ce0a55aecefe54 c26b2ff8fa8ff8e4 31f0eef398b73b35
        d49844778ee045fc c111f7a603306e77 dbaa2e7b656d8c67 fd2c7b6075de77ec 26b7c920c9106a2d
        e5d0da061bc57654 d823c87fd6f19c23 e3da1d4d78fe9a4a e27b34a51109dd78 0149737890612f81
        6278dae71e8c164a 2795f856e42d6383 103b65f99e65b8d1 75239a9419a240c0 4c874cda83ef469f
        3b5f2e3fb1786e3a a571be7d460af4b5 d6ee7418e49aef14 f93a0c5a32daef64 be42e423dafdab0b
        663ad50fa9119f34 ac6f8c65f827baa1 aa92d8a8637f2fc7 c6cdc4d4eb86a968 eb72e0685a15256f
        4c99dabd33758294 7f905a7e424d2ebb 0e98797f31426c6b 107b62276851671a c897049b84228985
        96891f8eeb07e4db 3553c0d80dc35e9a 0b42906899c7de66 71a1683be6f7ab3e 05eb79d86cce435c
        fcfa92d930b797da bd281dc8a62524d6 0948dbce46eddfc6 38bf9a3e860a4f38 b1cd8d3a602106d2
        4d7a873fec1fadda 625be4a24a9172ab 390f97eb56367c6d e2d83a3ef48b698a f3965b13d71b5058
        d8910f9da47b4c26 eca1c8242e112c40 003e238641671b32 83b1ed5b477a4d24 7485c5af206c04b8
        2ad252bfb0d12034 57e71c60dfba8ebb 886a1d72eefe6049 a042362e357f8f0b 635e759a3440c1df
        505802c9a3270c68 f088d31c17a67220 b72f1ef8124a123a e741f604ddf233ca 8f3338bff9023c95
        0a230bbfe90d012d a25eddd7c8ff6597 ab04bbf07557b899 71e4acb3b8b41712 d595ed1f7854552e
        039fbebb4fe72d6a 1f8356faccc9d2bf 2608de31f0d0844a 1bd422e65b894708 98c7470edac39585
        e9bcb9b365ec9a7f 275a9323b8f0a222 704cda02ecf3a987 6094de9603356383 6403aed36c816256
        639e950bdb53ab74 27e68d8f99b2ab3d 1fe4aca76ac47a81 184587f3f9881f5c 689d9982cd815a3f
        ff78d388a1b560ab f8435e33bb90d4db 119fc550a217a35e 21598efe53bac8cc cc95d17294e3cba6
        f6eb23124a0d0622 5e8f89c0ea1b40b8 57f64b08b6b88954 05a70b133a1cd465 11768004f24d54a5
        ab9145525d1367c3 1d21549aba9c62b3 aa2c98f6cd3459af f6d59e9d60225fb3 dd682612e7e20079
        22f207c68896dcb9 f6542012a7293155 bd79664e989ca275 150f0d5655647cad 9b0d1e5e6c2b5ec1
        5eced0c63a548e83 e3c97d22a298d793 f587e16b9f15ad91 6d21ba7f290ee6d1 c4131f886bd1bdab
        605bbedcf9442fb3 391dfbcf82622565 bcf1009e54417629 18ea38a9933a25c5 5b25f698d932b302
        7f78fd1825608493 0bdb36667328ae2b 574a6f685db8c5b4 c7f2a089c53bf44e fda6b26d3e2d69a7
        c26c75043c73263f 228fa958b37d335b 3119e11ae41f59b9 6901fb36937303c3 f20380a6097dde13
        1aa9ed9327935669 1329a2ab4cf86fc1 90b833b8cf98cca2 8fb840f1ecabce6a 63fb7866e1a16742
        491ed1305edf7752 f6e3958653bbb716 ba77ce944c29deec c0e9f0dd92aff3d3 2a3eeab8af0ab143
        bbd1e0eb4fad2baa 319ba34fcac7ff70 2b91b4ec494575b9 fdc9e14f5facc535 0a17270f3d3853b0
        19e76f6e70e92de2 87ee681504a1dd0b 7d53094bd269fcb5 6b710956f8f99141 b4fcd43fcf99ca77
        7f516e574f0a72f3 03e209cd93386cbb 82e4b50cfdeeaa9f 73eb43f728ed73f3 b52bead37da15863
        9184618aa06adec9 2778fb41732ce0c3 2c20f8c9d6d505d7 708c7e5325cd6c1f 445e3867757c1640
        4f12e6da7e6b7084 51ce947afbf66fe3 55a88173abd3bce0 55f4503c6dfefb43 277a38276e7cd48a
        ec124d48d4cf544b c4149c7822f3a808 43251a5cbea676cb 1b430dcac4e7b292 066bb46b3a5df24d
        152ca111e5a62942 04a0d2e729b29f63 89893f6a4420f808 d04c7c9e230015c9 0b6a39ebd263eff8
        b9dd8469b29dc243 3191e8a1d66f1cf2 908388120cbdfa1f a65f86fbee3f8d3c 3a398b8c5af67ab7
        d59c7b9ea4722fd4 90caaa3790536f8f 7743df1aacacb6df c14c34e0f33e06fe e9448877ab671b6f
        0e969187c9af7b92 7b6570f90b5f58af f33fb9e5bd9dfbe6 eeab7da53093b44e 2e2ce8780e52e62b
        7c99c54884424ed5 c6ac95979708cec8 8da386effed04c88 b72ba6c7e4aea2b7 a22e357b3b971cbf
        157f71e96e7a390c 31b5087a525a21bf 77408516f0d86a8e 52392daba766112c 7ff3abf1735c3a19
        226be2db2afcb4b9 cb3fa150f5c473fe b28bfabc8dd95797 d517c38d66461806 59ecd1e0114f4c9d
        6c6eeabda6c1aff2 142757c62a3289a8 f9a7daba678c0847 ce2d7a1bd9563434 7609ae6506d477b8
        9ef89673e9bb8c7d 57d97a0e806d4a6b 68b176abdf394edb 4a9fefd8a1d7f7cf 3aeb340302505cfe
        90d701b5e28a164e 4ef1252fd1162c6e cd59e02bedee2c00 0bc8384a1e4f4d87 dccaa1ad9ee0c3df
        75f55e012b860517 6c117e17d70857ab dd273a0ac749b2fc f97edf2cf1e6d2de 9556d49cb192c09d
        587593ef07d2feb5 cc86f245be038556 c1801ccaa7e70a43 5b577cfcc3bca718 75516a61c989a7ef
        81949760a356903c 2046fb0158bd2e1b 618dc2e9b2219634 4e5dbf127fcae687 7876d726cfe706e8
        93518e1a280205a7 a4f9e95f30691b24 85e0ac333cf39411 d9e2bfdb29dfa6ea 28ca3bde98e087c8
        2d18f45adb691287 2345b2c42cd62cef 6e509510e8c7ce9e 1928a46ab16c685f 340d00ea59224506
        a7840adf3db25e67 282f13d8201854b0 a8f1e0d1c6fab61f 71e558a7c5ef818a fa4ffc4dba7e9b54
        938349e9bdfb4df3 d645f2f245adfa1b 972b9b5aad41f9ca 61f4ee844c56e6f6 a5f1a1eafdcb5593
        1e22b804560779a5 84e98c8c60e86224 70068be54ffcce45 c14692b2de3c10c6 724dedde483267be
        6f069b03f3579ba1 a61b1be4ea8f72fa e2dde65f70f596b8 3c239cbb516643c3 580d0a3effb91669
        6381b19019603555 0862c23a9b375d87 3da5f392396ef7c2 2ca7ac1490d08fbb 5bcefa4f04b27b5a
        e029c88e0528a584 a80bf59e81de196d 8ad414e3d5c6ddd8 0f4cb8f0e3771ebd 0eaa32719b8c181a
        ca601cfe643f1dda b0f9afc378a56b78 cd1efcf85b94084f 78ac9e4f73247607 486e21b7ee488ece
        afd40a02d0e1087f 5ce4c08e43f71b64 5fc743b2058b783f bcd2fdca9571120a de59a7a0b55dcfc2
        6e313a171940b1c2 46d64a9872d8b9a6 1fbc76f2ad2e8791 a9a9b699c44b166e 04b25fecea365397
        88cb0154023cbead ad201a71d8405301 64cc08a52bcf49a4 641536275b32cb72 5a2d5f67f98b9f63
        d672a681bcd0029a 4f80a17b21557f22 44595ac0b339ad79 36c239c0d221e090 8bf751843a901558
        55eb5f0064ed53b4 7c875f754a4b1e64 f72ebad20d8ed78e 5b3c22e3165fd63c 254ab6ea894fa714
        b117cf816ba30b2e fd4aa832155afcf2 06473990e1846d68 73f68081d48735ef 0281ca8abc1e2947
        99b2283caff3e46f d0d92e54352d5f4c 1f13f31bd7c31788 67f6177df68b57fa 7ca0ab561d26761d
        5704ef38f0bbf223 7ba731e0430d5234 b8f8d5bb83e62a8b 0000a3e0ebb432f1 906fb06cc505ad55
        b84761af488af152 b021a9b20e06fbdf 58b3924708a6a008 80c23822e0fa671b 20fdf401c8164ad5
        9347004a58ea5fcd 18eeb6f879e73458 fe6c79a21cc37660 81d2dcef012325b9 bd8170f39c8b45d0
        a9cf7eb767bc5b3c 5af77fb63d0fe330 97ad515e018881d8 cb19ac62a3d4f6e4 c8f3ce7114a7d304
        7458625bfa9be360 69278939f6ed99d1 3cf151d447ac9c69 22b6f178de857ec9 3a4a8ad9efe14731
        51c0f7970efa7325 d09e8b081b31f336 e9b0e3e7377ca3dc b20880211ae0b472 150c475d9f0fd563
        3089af7825394973 3b0a3a24cf2e96a5 c90ed3150f2982e3 858f0970a44ec5a2 c1c8ea3e9c215214
        f8ecf97a89b73d2d 9232af2f49d7acff e2fe96d26e231dc1 4d5ccc97cc98f353 9fbfd80c72ecf78b
        9e4dccbbe073d397 334473dda007499a 921a96256986e66b 50496ce60f8fcd0d bc8907e1aaee1d1f
        abc4ceec5b9ad2d3 81c2c897c35170d3 e582d46c50461dca ba68d64884ba7f0f d5cdacb76b3e4933
        7693d5d4854b01dc 7568abd85ee5de70 6148546ce8caae8f 676ac37466648f53 b3d5e17d1e49dacc
        1ee3930c73b173da 43da6b060db34694 bfaf7718c2eb05fa 156195332bdb8386 d4acc59cbad1842f
        61e5078cbe1407dd f55b398432e0b647 6212b096bf8827d5 00ced651148d1ea3 0c5b2f65f81b0978
        ece49edbaeaaa066 f419427c37f8c4bf 209b0225f4dcc88b 2a8a990449f34903 b8cd567e7a90bf3b
        fa50939c84ccc39c cd6a73649257d018 823f7663505a8f23 f680265cf20ff761 a48541928e77e1ec
        5576e30c9410d31a 440a15abed6fac69 a8b9923768e47e47 dbaabbcda992b709 b2afd2179a733f09
        2f36f6361a92d4ce 2abafd11e2004959 3473cab308fe355a 11950d6d48aad518 310d9bae31eabb44
        556201f69a835916 362c822d73ce19f5 2a9ef1e92b9ae031 e74d872756b3bb8e b0d61af9f4257088
        cf057d0774945403 a896d5507812d0c8 a4eea45d681f0518
    `.trim().split(/\s+/).map(key => BigInt('0x' + key));
    const slotByKey = new Map(catalogV1.map((key, index) => [key, index]));

    function publicProfile(profile) {
        const fields = profile.shareGender === 'yes' ? [...publicFields, 'shareGender', 'gender', 'partnerGender'] : publicFields;
        return Object.fromEntries(fields.filter(key => Object.hasOwn(profile, key)).map(key => [key, profile[key]]));
    }

    function packRatings(slots, ratedSlots, { base, perByte }) {
        // Sparse links store only rated slots, with three bits for each rating.
        const denseLength = Math.ceil(((ratedSlots.at(-1) ?? -1) + 1) / perByte);
        const sparse = ratedSlots.length * 2 < denseLength;
        const bytes = new Uint8Array(sparse ? ratedSlots.length * 2 : denseLength);
        if (sparse) {
            const view = new DataView(bytes.buffer);
            ratedSlots.forEach((slot, index) => view.setUint16(index * 2, slot * 8 + slots[slot]));
        } else {
            for (let i = 0; i < bytes.length; i++) {
                const offset = i * perByte;
                let packed = 0;
                for (let digit = perByte - 1; digit >= 0; digit--) {
                    packed = packed * base + (slots[offset + digit] ?? 0);
                }
                bytes[i] = packed;
            }
        }
        return { bytes, sparse };
    }

    function toBase64Url(bytes) {
        return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function createChecklistShareUrl(profileId) {
        let checklist;
        try {
            checklist = profileId === undefined ? readChecklist() : DBList.readSavedChecklist(profileId);
        } catch {
            throw new Error('Could not load saved answers. Check your browser storage settings.');
        }
        const { answers, profile } = checklist;
        const slots = new Uint8Array(catalogV1.length);
        const extras = [];
        let advanced = profileId === undefined ? DBList.advancedMode : profile.mode === 'advanced';
        let fantasy = profileId === undefined ? DBList.showFantasy : profile.fantasy === '1';
        for (const { id, key, advanced: needsAdvanced, fantasy: needsFantasy } of choices) {
            if (!answers[id]) continue;
            const rating = ratings.indexOf(answers[id]);
            if (rating < 1) throw new Error('This rating cannot be shared in a link.');
            const slot = slotByKey.get(key);
            if (slot === undefined) extras.push({ key, rating });
            else slots[slot] = rating;
            if (needsAdvanced) advanced = true;
            if (needsFantasy) fantasy = true;
        }
        const ratedSlots = Array.from(slots.keys()).filter(index => slots[index]);
        const shareGender = Object.hasOwn(profile, 'gender') || Object.hasOwn(profile, 'partnerGender') ? 'yes' : 'no';
        const sharedProfile = publicProfile({ ...profile, shareGender });
        const details = Object.keys(sharedProfile).length ? encoder.encode(JSON.stringify(sharedProfile)) : new Uint8Array();
        if (!ratedSlots.length && !extras.length && !details.length) {
            throw new Error('Save some ratings or profile details before creating a share link.');
        }

        const format = Object.values(answers).includes('willing-to-try') ? expandedFormat : originalFormat;
        const packed = packRatings(slots, ratedSlots, format);
        const extended = extras.length > 0 || details.length > 0;
        const headerBytes = 1 + (extended ? extendedHeaderBytes : 0);
        const size = headerBytes + packed.bytes.length + extras.length * extraRatingBytes + details.length + checksumBytes;
        if (size > maxPayloadBytes) throw new Error('These ratings are too large for a share link. You can export a JSON backup instead.');
        const bytes = new Uint8Array(size);
        const view = new DataView(bytes.buffer);
        const flags = format.version | (advanced ? compactShareRoute.advancedFlag : 0) | (fantasy ? compactShareRoute.fantasyFlag : 0) |
            (packed.sparse ? sparseFlag : 0) | (extended ? extendedFlag : 0);
        bytes[0] = flags << 2;
        if (extended) {
            view.setUint16(1, packed.bytes.length);
            view.setUint16(3, extras.length);
        }
        bytes.set(packed.bytes, headerBytes);
        let offset = headerBytes + packed.bytes.length;
        for (const { key, rating } of extras) {
            view.setBigUint64(offset, key);
            bytes[offset + 8] = rating;
            offset += extraRatingBytes;
        }
        bytes.set(details, offset);
        const end = size - checksumBytes;
        view.setUint32(end, Number(BigInt.asUintN(32, fingerprint(bytes.subarray(0, end)))));

        const url = new URL('share.html', location.href);
        url.hash = compactPrefix + toBase64Url(bytes);
        return url.href;
    }

    function checklistShareHash(hash) {
        return hash.startsWith(compactPrefix) || hash.startsWith(legacyPrefix) ? hash.split('&', 1)[0] : '';
    }

    function parseChecklistShareHash(hash) {
        const legacy = hash.startsWith(legacyPrefix);
        let payload = hash.slice(compactPrefix.length);
        if (legacy) {
            const [linkVersion, data, unexpected] = hash.slice(legacyPrefix.length).split('.');
            if (!data || unexpected !== undefined || !/^\d+$/.test(linkVersion)) {
                throw new Error('This share link is incomplete. Ask for the full link.');
            }
            if (linkVersion !== '1') throw new Error('This share link uses an unsupported version.');
            payload = data;
        }

        const invalidLink = new Error('This share link is damaged or incomplete. Ask for a new link.');
        if (payload.length > maxPayloadBytes * 4 / 3 || !/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) {
            throw invalidLink;
        }
        const bytes = Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), character => character.charCodeAt(0));
        const end = bytes.length - checksumBytes;
        if (end < 1 || toBase64Url(bytes) !== payload) throw invalidLink;
        const flags = bytes[0] >>> 2;
        const version = legacy ? originalFormat.version : flags & compactVersionMask;
        if (version !== originalFormat.version && version !== expandedFormat.version) {
            throw new Error('This share link uses an unsupported version.');
        }
        const { base, perByte } = version === expandedFormat.version ? expandedFormat : originalFormat;
        if (!legacy && (bytes[0] & 3)) throw invalidLink;
        const view = new DataView(bytes.buffer);
        if (view.getUint32(end) !== Number(BigInt.asUintN(32, fingerprint(bytes.subarray(0, end))))) throw invalidLink;
        const extended = legacy || Boolean(flags & extendedFlag);
        const headerOffset = legacy ? 0 : 1;
        const headerBytes = headerOffset + (extended ? extendedHeaderBytes : 0);
        if (end < headerBytes) throw invalidLink;
        const layout = extended ? view.getUint16(headerOffset) : end - headerBytes;
        const sparse = legacy ? Boolean(layout & legacySparseFlag) : Boolean(flags & sparseFlag);
        const ratingsLength = legacy ? layout & ~legacySparseFlag : layout;
        const ratingsEnd = headerBytes + ratingsLength;
        const extrasEnd = extended ? ratingsEnd + view.getUint16(headerOffset + 2) * extraRatingBytes : ratingsEnd;
        if (extrasEnd > end || (sparse && ratingsLength % 2) ||
            (!sparse && ratingsLength > Math.ceil(catalogV1.length / perByte))) throw invalidLink;

        const answers = Object.create(null);
        let skipped = 0;
        function readRating(key, rating) {
            if (key === undefined || rating < 1 || rating >= base) throw invalidLink;
            const id = choicesByKey.get(key);
            if (id === undefined) skipped++;
            else answers[id] = ratings[rating];
        }

        if (sparse) {
            let previousSlot = -1;
            for (let offset = headerBytes; offset < ratingsEnd; offset += 2) {
                const entry = view.getUint16(offset);
                const slot = entry >>> 3;
                if (slot <= previousSlot) throw invalidLink;
                readRating(catalogV1[slot], entry & 7);
                previousSlot = slot;
            }
        } else {
            let slot = 0;
            for (let offset = headerBytes; offset < ratingsEnd; offset++) {
                let packed = bytes[offset];
                if (packed >= base ** perByte) throw invalidLink;
                for (let i = 0; i < perByte; i++, slot++) {
                    const rating = packed % base;
                    if (rating) readRating(catalogV1[slot], rating);
                    packed = Math.floor(packed / base);
                }
            }
        }

        const extraKeys = new Set();
        for (let offset = ratingsEnd; offset < extrasEnd; offset += extraRatingBytes) {
            const key = view.getBigUint64(offset);
            if (slotByKey.has(key) || extraKeys.has(key)) throw invalidLink;
            readRating(key, bytes[offset + 8]);
            extraKeys.add(key);
        }

        let profile = {};
        if (extrasEnd < end) {
            try {
                const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(extrasEnd, end)));
                const details = readProfilePatch(data);
                profile = publicProfile(details.profile);
                skipped += details.skipped + Object.keys(details.profile).length - Object.keys(profile).length;
            } catch {
                throw invalidLink;
            }
        }
        return { answers, profile, skipped };
    }

    function bindChecklistShareUrl(createUrl = createChecklistShareUrl) {
        const options = document.querySelector('#share-url-options');
        const button = options.querySelector('#copy-share-link');
        const input = options.querySelector('#share-link');
        const status = options.querySelector('#share-link-status');
        const toggle = options.querySelector('#toggle-share-link');
        const field = options.querySelector('#share-link-field');

        function setLinkVisibility(visible) {
            field.hidden = !visible;
            toggle.setAttribute('aria-expanded', String(visible));
            toggle.textContent = visible ? 'Hide link' : 'Show link';
        }

        function refresh() {
            status.textContent = '';
            try {
                input.value = options.hidden ? '' : createUrl();
                button.disabled = !input.value;
            } catch (error) {
                input.value = '';
                button.disabled = true;
                status.textContent = error.message;
            }
            if (toggle) {
                toggle.disabled = !input.value;
                if (toggle.disabled) setLinkVisibility(false);
            }
        }

        if (toggle) {
            toggle.addEventListener('click', () => setLinkVisibility(field.hidden));
        }
        button.addEventListener('click', async () => {
            refresh();
            if (!input.value) return;
            const url = input.value;
            button.disabled = true;
            try {
                await navigator.clipboard.writeText(url);
                if (input.value === url) status.textContent = 'URL copied.';
            } catch {
                if (input.value === url) {
                    if (toggle) setLinkVisibility(true);
                    input.focus();
                    input.select();
                    status.textContent = 'Copy the URL from the selected field.';
                }
            } finally {
                button.disabled = !input.value;
            }
        });
        return refresh;
    }

    Object.assign(DBList, { createChecklistShareUrl, checklistShareHash, parseChecklistShareHash, bindChecklistShareUrl });
})();
