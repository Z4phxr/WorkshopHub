using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace Projekt.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        // Static readonly seed arrays to avoid CA1861 warnings (reuse, no repeated allocations)
        private static readonly object[,] SeedAddresses = new object[,]
        {
            { 50, "Stare Miasto", "12", "Kraków", "1", "ul. Floriańska" },
            { 51, "Blisko Wawelu", "25", "Kraków", "2", "ul. Grodzka" },
            { 52, "Wejście od podwórza", "7", "Kraków", "101", "ul. Długa" },
            { 53, "2 piętro", "3A", "Kraków", "Sala szkoleniowa", "ul. Karmelicka" },
            { 54, "Śródmieście", "89", "Warszawa", "A", "ul. Marszałkowska" },
            { 55, "Metro Centrum", "15", "Warszawa", "B", "ul. Świętokrzyska" },
            { 56, "Kamienica", "44", "Warszawa", "3", "ul. Mokotowska" },
            { 57, "Parking z tyłu", "120", "Warszawa", "Sala 2", "ul. Puławska" }
        };
        private static readonly object[,] SeedCategories = new object[,]
        {
            { 1001, "Workshops focused on instrumental, vocal and rhythm skills.", "Music" },
            { 1002, "Art and creative expression through various painting techniques.", "Painting" },
            { 1003, "Workshops for learning digital and analog photography.", "Photography" },
            { 1004, "Culinary workshops focused on practical cooking skills.", "Cooking" },
            { 1005, "Creative hand-made crafting workshops: ceramics, sewing, DIY.", "Handcraft" },
            { 1006, "Workshops teaching digital illustration, design and graphic tools.", "Digital Art" }
        };
        private static readonly object[,] SeedRoles = new object[,]
        {
            { 1, "Administrator with full privileges", "Admin" },
            { 2, "Workshop instructor role", "Instructor" },
            { 3, "Default participant role", "Participant" }
        };
        private static readonly object[,] SeedUsers = new object[,]
        {
            { 300, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "admin@gmail.com", "Admin", "User", "PBKDF2$100000$poQqsmFoMEhyq+OZGQuqNA==$FiwCznvrzeIrygvrSsLKg+zeLOGzdEKBKX6yUF8Y9n4=" },
            { 301, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "emma.clark@example.com", "Emma", "Clark", "PBKDF2$100000$fAOe6EvSktj3LeaKfMv9pw==$LPtdYos6cJWAqKJuK0qpYZP1pM5PEHeoq6Gn2XuSUPw=" },
            { 302, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "liam.foster@example.com", "Liam", "Foster", "PBKDF2$100000$z+YpPjGBQrRTSd4UIZ6+lA==$mRekrpKtMED54QIO56INeSLajvHMoac/Re+nja5LYWQ=" },
            { 303, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "olivia.hayes@example.com", "Olivia", "Hayes", "PBKDF2$100000$ylvZzdlqZCfEriNBug77nw==$bobbTivyLqtTFQXZ8Vjuo7RGOtuqag4gijd8zw6Sxhc=" },
            { 304, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "noah.reed@example.com", "Noah", "Reed", "PBKDF2$100000$WTQKYqe9CGyeKYLEjW957A==$gAxAq0iknJQndcWxxHWbmtgbG625X6nDBdmxUJzSpnY=" },
            { 305, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "ava.mitchell@example.com", "Ava", "Mitchell", "PBKDF2$100000$zNb/+4lxTJA7Y+6CpjeweA==$EbOTxJiJ01YpivxP+ZJFVJP6b064lU860oSOoU+x4zc=" },
            { 306, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "mason.turner@example.com", "Mason", "Turner", "PBKDF2$100000$uQlosHzi1jSZBBeh8SGRVg==$BbeuE7I9SU09FA2DwAHbqAiUC32XexWci7vN530FAik=" },
            { 307, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "sophia.bennett@example.com", "Sophia", "Bennett", "PBKDF2$100000$YHhOqyuHP5yTlAs1329hRA==$3jSzZPErkTP8wh1nI6tZ5H5uPMntu1/bc+y9hQV/NDE=" },
            { 308, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "ethan.cole@example.com", "Ethan", "Cole", "PBKDF2$100000$+c6oZxt/UqKV/LuM2cmdiQ==$Wk33XC+fBr1/TuGLMscFLj3yLznv0wjXtGPxjoljQkI=" },
            { 309, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "isabella.parker@example.com", "Isabella", "Parker", "PBKDF2$100000$WwYUKxQWivlVeEpp2MgTCw==$b8YpfwdMDTwF6uLh+rxwUHQFuDl6DMW/xQsPschb+aI=" },
            { 310, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "logan.murphy@example.com", "Logan", "Murphy", "PBKDF2$100000$iKNWL4Dmgw78KfxRt2Mm+Q==$Mpw4sf0E7b04vdTTm4KqmeQj7s6JPZZpjP6bTzhaKdk=" },
            { 311, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "mia.hughes@example.com", "Mia", "Hughes", "PBKDF2$100000$kds6vCJpoPtBhvdORCCtLw==$P4M8Recj+QJCL/b546nujZOfuJhwVG2LYhZiQphEXAU=" },
            { 312, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "jacob.ward@example.com", "Jacob", "Ward", "PBKDF2$100000$zAb+TtfAv+s4i45F4CFzyw==$kMqeNB0NitU+RMzYuMMQ18heQzGtVO3gMYUMyITgbdg=" },
            { 313, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "charlotte.price@example.com", "Charlotte", "Price", "PBKDF2$100000$qGC2nS1na8YAFR6+PhOf3Q==$L2VucAp7KXva570Lz44EYnKQALsgUr4mcvovidN7i3c=" },
            { 314, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "elijah.russell@example.com", "Elijah", "Russell", "PBKDF2$100000$7ZoCIzPV1oEm7CF4JwLNrg==$dIT9NiULxEKI4SyORAK8qLAMvL8RjQv/zIWTHiF0l2Q=" },
            { 315, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "harper.griffin@example.com", "Harper", "Griffin", "PBKDF2$100000$SODPiZpTyWC2FqDKpFou4w==$7fSn0l6apniyLYFjOo3fVupPPFux3d4Ed02zanVbnsw=" },
            { 316, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "daniel.sanders@example.com", "Daniel", "Sanders", "PBKDF2$100000$kkb2f/XcdUIq2ZBtN2Swng==$R4cVoFytT4hKJ8tyGo+nSLGFh0BsuqVFsbiyPqQmKGs=" },
            { 317, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "amelia.ross@example.com", "Amelia", "Ross", "PBKDF2$100000$YK+Qlrn8jnvTG8fBR5W9MQ==$CBN5CAQ8kwpHgMAMxdLF0Jc1VredqBm8ar9tUDxoZgc=" },
            { 318, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "henry.peterson@example.com", "Henry", "Peterson", "PBKDF2$100000$F1Td4JoTj5AKzT/gjLkYQQ==$PPkFBHwRJU1bqyeDi/elTucLjysoTs26QCaEw14Vfos=" },
            { 319, new DateTime(2025, 1, 1, 0, 0, 0, 0, DateTimeKind.Utc), "grace.howard@example.com", "Grace", "Howard", "PBKDF2$100000$EU5HceSFyP1HzwfSw93WoQ==$uHxqGP27JiJY8Ruaqf822TuZkEr7PPJTeIko3jS2uBM=" }
        };
        private static readonly object[,] SeedUserRoles = new object[,]
        {
            { 1, 300 }, { 2, 301 }, { 2, 302 }, { 2, 303 }, { 2, 304 },
            { 3, 305 }, { 3, 306 }, { 3, 307 }, { 3, 308 }, { 3, 309 },
            { 3, 310 }, { 3, 311 }, { 3, 312 }, { 3, 313 }, { 3, 314 },
            { 3, 315 }, { 3, 316 }, { 3, 317 }, { 3, 318 }, { 3, 319 }
        };
        private static readonly object[,] SeedWorkshops = new object[,]
        {
            { 2003, 50, null, 1001, 301, "A focused beginner program that guides students through four progressive weekly sessions, introducing essential chords, rhythm techniques, and foundational playing skills while building confidence and musical fluency in a supportive, hands-on environment.", "/workshop-images/guitar_course.jpg", true, 14, 480m, "/workshop-images/guitar_course.jpg", "4-Week Guitar Course" },
            { 2004, 50, null, 1001, 301, "A practical introduction to songwriting where participants learn how to build a simple song structure, write lyrics around a theme and create a basic chord progression. Each participant finishes the workshop with a draft of their own song.", "/workshop-images/intro_songwriting.jpg", false, 12, 180m, "/workshop-images/intro_songwriting.jpg", "Intro to Songwriting" },
            { 2005, 55, null, 1002, 302, "An intensive acrylic painting workshop focused on expressive portraits. Participants learn how to block in shapes, work with a limited color palette and add highlights and texture to bring faces to life on canvas.", "/workshop-images/expressive_portraits_acrylics.jpg", false, 10, 190m, "/workshop-images/expressive_portraits_acrylics.jpg", "Expressive Portrait Painting in Acrylics" },
            { 2006, 52, null, 1003, 303, "A hands-on DSLR photography workshop where participants practice controlling shutter speed, aperture and ISO, and learn how to compose stronger images using leading lines, framing and the rule of thirds.", "/workshop-images/dslr_light_composition.jpg", false, 12, 200m, "/workshop-images/dslr_light_composition.jpg", "DSLR Photography: Light & Composition" },
            { 2007, 53, null, 1005, 304, "A practical ceramic course where participants design, shape and finish their own mug. The workshop covers forming the basic shape, adding a handle and refining the surface so the mug is ready for glazing and firing.", "/workshop-images/handmade_ceramic_mugs.jpg", true, 8, 520m, "/workshop-images/handmade_ceramic_mugs.jpg", "Handmade Ceramic Mugs" },
            { 2008, 57, null, 1005, 302, "An embroidery workshop for beginners that covers basic stitches, transferring simple designs onto fabric and building small decorative motifs that can be used on tote bags, clothing or framed as wall art.", "/workshop-images/creative_embroidery_beginners.jpg", false, 12, 150m, "/workshop-images/creative_embroidery_beginners.jpg", "Creative Embroidery for Beginners" },
            { 2009, 54, null, 1002, 303, "A creative workshop focused on drawing expressive faces and figures using only clean, minimal lines. Participants explore gesture drawing, quick warm-up sketches and simple composition tricks to make their drawings feel dynamic even with very limited detail. No prior drawing experience is required, just curiosity and willingness to experiment.", "/workshop-images/minimalist_line_drawing.jpg", false, 14, 160m, "/workshop-images/minimalist_line_drawing.jpg", "Minimalist Line Drawing – Faces and Figures" },
            { 2010, 56, null, 1006, 304, "A beginner-friendly digital illustration workshop focused on creating simple but polished character or object illustrations in a tablet app such as Procreate. Participants learn how to work with layers, brushes, basic shading and color palettes. By the end, each person finishes one small illustration ready to export for social media or as a phone wallpaper.", "/workshop-images/procreate_illustration_starter_lab.jpg", true, 10, 360m, "/workshop-images/procreate_illustration_starter_lab.jpg", "Procreate Illustration Starter Lab" },
            { 2011, 55, null, 1004, 301, "A practical cooking workshop where participants prepare two or three simple comfort food dishes inspired by different cuisines, such as a creamy pasta, a simple curry and a quick dessert. The instructor explains knife safety, timing and how to plan a small menu so participants can easily repeat the recipes at home.", "/workshop-images/comfort_food_around_the_world.jpg", false, 12, 220m, "/workshop-images/comfort_food_around_the_world.jpg", "Comfort Food From Around the World" },
            { 2000, 52, null, 1003, 301, "A beginner-friendly workshop that introduces participants to the core foundations of photography, guiding them through essential camera settings, framing and composition techniques, and practical approaches to natural and artificial lighting, all aimed at helping them develop control, confidence, and a more intentional creative eye behind the lens.", "/workshop-images/photography_basics.jpg", false, 12, 190m, "/workshop-images/photography_basics.jpg", "Photography Basics" },
            { 2001, 55, 4.50m, 1002, 302, "A focused beginner program that guides students through four progressive weekly sessions, introducing essential chords, rhythm techniques, and foundational playing skills while building confidence and musical fluency in a supportive, hands-on environment.", "/workshop-images/acrylic_painting.jpg", false, 14, 150m, "/workshop-images/acrylic_painting.jpg", "Watercolor Painting" },
            { 2002, 51, 5.00m, 1006, 303, "A guided workshop that helps participants develop a distinctive narrative voice, create vivid and believable characters, and craft natural, engaging dialogue through focused exercises that inspire experimentation and strengthen overall storytelling skills.", "/workshop-images/creative_writing.jpg", false, 16, 130m, "/workshop-images/creative_writing.jpg", "Creative Writing" },

        };

        private static readonly object[,] SeedCycles = new object[,]
        {
            { 2120, 52, "DSLR Light & Composition – Sept 18 2025", new DateTime(2025, 9, 18, 13, 0, 0, 0, DateTimeKind.Utc), null, false, null, new DateTime(2025, 9, 18, 10, 0, 0, 0, DateTimeKind.Utc), 2006 },
            { 2121, 51, "DSLR Light & Composition – Apr 10 2026", new DateTime(2026, 4, 10, 13, 0, 0, 0, DateTimeKind.Utc), null, true, 10, new DateTime(2026, 4, 10, 10, 0, 0, 0, DateTimeKind.Utc), 2006 },
            { 2122, 53, "Ceramic Mugs – Nov Series 2025", new DateTime(2025, 11, 23, 19, 0, 0, 0, DateTimeKind.Utc), 304, false, 6, new DateTime(2025, 11, 2, 17, 0, 0, 0, DateTimeKind.Utc), 2007 },
            { 2123, 53, "Ceramic Mugs – Feb Series 2026", new DateTime(2026, 2, 20, 19, 0, 0, 0, DateTimeKind.Utc), 304, true, 8, new DateTime(2026, 1, 30, 17, 0, 0, 0, DateTimeKind.Utc), 2007 },
            { 2124, 53, "Ceramic Mugs – Apr Series 2026", new DateTime(2026, 4, 27, 19, 0, 0, 0, DateTimeKind.Utc), 304, true, 8, new DateTime(2026, 4, 6, 17, 0, 0, 0, DateTimeKind.Utc), 2007 },
            { 2125, 57, "Embroidery – Oct 18 2025", new DateTime(2025, 10, 18, 13, 0, 0, 0, DateTimeKind.Utc), null, false, null, new DateTime(2025, 10, 18, 10, 0, 0, 0, DateTimeKind.Utc), 2008 },
            { 2126, 56, "Embroidery – Mar 9 2026", new DateTime(2026, 3, 9, 13, 0, 0, 0, DateTimeKind.Utc), 302, true, null, new DateTime(2026, 3, 9, 10, 0, 0, 0, DateTimeKind.Utc), 2008 },
            { 2127, 54, "Line Drawing – Nov 9 2025", new DateTime(2025, 11, 9, 15, 0, 0, 0, DateTimeKind.Utc), null, false, null, new DateTime(2025, 11, 9, 12, 0, 0, 0, DateTimeKind.Utc), 2009 },
            { 2128, 56, "Line Drawing – Apr 14 2026", new DateTime(2026, 4, 14, 15, 0, 0, 0, DateTimeKind.Utc), null, true, 14, new DateTime(2026, 4, 14, 12, 0, 0, 0, DateTimeKind.Utc), 2009 },
            { 2129, 56, "Procreate Lab – Jan 2026 Series", new DateTime(2026, 1, 25, 18, 0, 0, 0, DateTimeKind.Utc), 304, true, 10, new DateTime(2026, 1, 11, 16, 0, 0, 0, DateTimeKind.Utc), 2010 },
            { 2130, 55, "Comfort Food – Nov 28 2025", new DateTime(2025, 11, 28, 18, 0, 0, 0, DateTimeKind.Utc), null, false, null, new DateTime(2025, 11, 28, 15, 0, 0, 0, DateTimeKind.Utc), 2011 },
            { 2131, 54, "Comfort Food – Mar 20 2026", new DateTime(2026, 3, 20, 18, 0, 0, 0, DateTimeKind.Utc), null, true, null, new DateTime(2026, 3, 20, 15, 0, 0, 0, DateTimeKind.Utc), 2011 },
            { 2100, null, "Photography Basics – Sept 10 2025", new DateTime(2025, 9, 10, 13, 0, 0, 0, DateTimeKind.Utc), null, false, null, new DateTime(2025, 9, 10, 10, 0, 0, 0, DateTimeKind.Utc), 2000 },
            { 2101, null, "Photography Basics – Dec 15 2025", new DateTime(2025, 12, 15, 13, 0, 0, 0, DateTimeKind.Utc), null, true, null, new DateTime(2025, 12, 15, 10, 0, 0, 0, DateTimeKind.Utc), 2000 },
            { 2102, null, "Acrylic Painting – Aug 20 2025", new DateTime(2025, 8, 20, 12, 0, 0, 0, DateTimeKind.Utc), null, false, null, new DateTime(2025, 8, 20, 9, 0, 0, 0, DateTimeKind.Utc), 2001 },
            { 2103, null, "Acrylic Painting – Jan 18 2026", new DateTime(2026, 1, 18, 12, 0, 0, 0, DateTimeKind.Utc), null, true, null, new DateTime(2026, 1, 18, 9, 0, 0, 0, DateTimeKind.Utc), 2001 },
            { 2104, null, "Creative Writing – Oct 5 2025", new DateTime(2025, 10, 5, 20, 0, 0, 0, DateTimeKind.Utc), null, false, null, new DateTime(2025, 10, 5, 17, 0, 0, 0, DateTimeKind.Utc), 2002 },
            { 2105, null, "Creative Writing – Feb 10 2026", new DateTime(2026, 2, 10, 20, 0, 0, 0, DateTimeKind.Utc), null, true, null, new DateTime(2026, 2, 10, 17, 0, 0, 0, DateTimeKind.Utc), 2002 },
            { 2106, null, "4-Week Guitar Course – March 2026", new DateTime(2026, 3, 25, 20, 0, 0, 0, DateTimeKind.Utc), null, true, null, new DateTime(2026, 3, 4, 18, 0, 0, 0, DateTimeKind.Utc), 2003 },
            { 2107, 50, "Intro to Songwriting – Oct 12 2025", new DateTime(2025, 10, 12, 20, 0, 0, DateTimeKind.Utc), null, false, null, new DateTime(2025, 10, 12, 17, 0, 0, 0, DateTimeKind.Utc), 2004 },
            { 2117, 54, "Intro to Songwriting – Feb 15 2026", new DateTime(2026, 2, 15, 20, 0, 0, 0, DateTimeKind.Utc), 302, true, null, new DateTime(2026, 2, 15, 17, 0, 0, 0, DateTimeKind.Utc), 2004 },
            { 2118, 55, "Expressive Portraits – Nov 5 2025", new DateTime(2025, 11, 5, 14, 0, 0, 0, DateTimeKind.Utc), null, false, null, new DateTime(2025, 11, 5, 10, 0, 0, 0, DateTimeKind.Utc), 2005 },
            { 2119, 55, "Expressive Portraits – Jan 22 2026", new DateTime(2026, 1, 22, 14, 0, 0, 0, DateTimeKind.Utc), null, true, 8, new DateTime(2026, 1, 22, 10, 0, 0, 0, DateTimeKind.Utc), 2005 }

        };


        private static readonly object[,] SeedWorkshopSessions = new object[,]
     {
        { 2200, 52, new DateTime(2025,9,10,13,0,0,DateTimeKind.Utc), new DateTime(2025,9,10,10,0,0,DateTimeKind.Utc), "Photography Basics – Core Session", 2100 },
        { 2201, 52, new DateTime(2025,12,15,13,0,0,DateTimeKind.Utc), new DateTime(2025,12,15,10,0,0,DateTimeKind.Utc), "Photography Basics – Core Session", 2101 },
        { 2202, 55, new DateTime(2025,8,20,12,0,0,DateTimeKind.Utc), new DateTime(2025,8,20,9,0,0,DateTimeKind.Utc), "Acrylic Painting – Techniques Session", 2102 },
        { 2203, 55, new DateTime(2026,1,18,12,0,0,DateTimeKind.Utc), new DateTime(2026,1,18,9,0,0,DateTimeKind.Utc), "Acrylic Painting – Techniques Session", 2103 },
        { 2204, 51, new DateTime(2025,10,5,20,0,0,DateTimeKind.Utc), new DateTime(2025,10,5,17,0,0,DateTimeKind.Utc), "Creative Writing – Narrative Fundamentals", 2104 },
        { 2205, 51, new DateTime(2026,2,10,20,0,0,DateTimeKind.Utc), new DateTime(2026,2,10,17,0,0,DateTimeKind.Utc), "Creative Writing – Narrative Fundamentals", 2105 },
        { 2206, 50, new DateTime(2026,3,4,20,0,0,DateTimeKind.Utc), new DateTime(2026,3,4,18,0,0,DateTimeKind.Utc), "Guitar Basics", 2106 },
        { 2207, 50, new DateTime(2026,3,11,20,0,0,DateTimeKind.Utc), new DateTime(2026,3,11,18,0,0,DateTimeKind.Utc), "Chords & Rhythm", 2106 },
        { 2208, 50, new DateTime(2026,3,18,20,0,0,DateTimeKind.Utc), new DateTime(2026,3,18,18,0,0,DateTimeKind.Utc), "Strumming Patterns & Dynamics", 2106 },
        { 2209, 50, new DateTime(2026,3,25,20,0,0,DateTimeKind.Utc), new DateTime(2026,3,25,18,0,0,DateTimeKind.Utc), "Song Playthrough & Review", 2106 },

        // FIXED HERE ↓↓↓
        { 2210, 50, new DateTime(2025,10,12,20,0,0,DateTimeKind.Utc), new DateTime(2025,10,12,17,0,0,DateTimeKind.Utc), "Intro to Songwriting – Core Session", 2107 },

        { 2211, 54, new DateTime(2026,2,15,20,0,0,DateTimeKind.Utc), new DateTime(2026,2,15,17,0,0,DateTimeKind.Utc), "Intro to Songwriting – Core Session", 2117 },
        { 2212, 55, new DateTime(2025,11,5,14,0,0,DateTimeKind.Utc), new DateTime(2025,11,5,10,0,0,0, DateTimeKind.Utc), "Expressive Portraits – Main Workshop", 2118 },
        { 2213, 55, new DateTime(2026,1,22,14,0,0,DateTimeKind.Utc), new DateTime(2026,1,22,10,0,0,0, DateTimeKind.Utc), "Expressive Portraits – Main Workshop", 2119 },

        { 2214, 52, new DateTime(2025,9,18,13,0,0,DateTimeKind.Utc), new DateTime(2025,9,18,10,0,0,0, DateTimeKind.Utc), "DSLR Light & Composition – Core Session", 2120 },
        { 2215, 51, new DateTime(2026,4,10,13,0,0,0, DateTimeKind.Utc), new DateTime(2026,4,10,10,0,0,0, DateTimeKind.Utc), "DSLR Light & Composition – Core Session", 2121 },

        { 2216, 53, new DateTime(2025,11,2,19,0,0,DateTimeKind.Utc), new DateTime(2025,11,2,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 1", 2122 },
        { 2217, 53, new DateTime(2025,11,9,19,0,0,DateTimeKind.Utc), new DateTime(2025,11,9,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 2", 2122 },
        { 2218, 53, new DateTime(2025,11,16,19,0,0,DateTimeKind.Utc), new DateTime(2025,11,16,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 3", 2122 },
        { 2219, 53, new DateTime(2025,11,23,19,0,0,DateTimeKind.Utc), new DateTime(2025,11,23,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 4", 2122 },

        { 2220, 53, new DateTime(2026,1,30,19,0,0,DateTimeKind.Utc), new DateTime(2026,1,30,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 1", 2123 },
        { 2221, 53, new DateTime(2026,2,6,19,0,0,DateTimeKind.Utc), new DateTime(2026,2,6,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 2", 2123 },
        { 2222, 53, new DateTime(2026,2,13,19,0,0,DateTimeKind.Utc), new DateTime(2026,2,13,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 3", 2123 },
        { 2223, 53, new DateTime(2026,2,20,19,0,0,DateTimeKind.Utc), new DateTime(2026,2,20,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 4", 2123 },

        { 2224, 53, new DateTime(2026,4,6,19,0,0,DateTimeKind.Utc), new DateTime(2026,4,6,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 1", 2124 },
        { 2225, 53, new DateTime(2026,4,13,19,0,0,DateTimeKind.Utc), new DateTime(2026,4,13,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 2", 2124 },
        { 2226, 53, new DateTime(2026,4,20,19,0,0,DateTimeKind.Utc), new DateTime(2026,4,20,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 3", 2124 },
        { 2227, 53, new DateTime(2026,4,27,19,0,0,DateTimeKind.Utc), new DateTime(2026,4,27,17,0,0,0, DateTimeKind.Utc), "Ceramic Mugs – Session 4", 2124 },

        { 2228, 57, new DateTime(2025,10,18,13,0,0,DateTimeKind.Utc), new DateTime(2025,10,18,10,0,0,0, DateTimeKind.Utc), "Embroidery – Core Workshop", 2125 },
        { 2229, 56, new DateTime(2026,3,9,13,0,0,0, DateTimeKind.Utc), new DateTime(2026,3,9,10,0,0,0, DateTimeKind.Utc), "Embroidery – Core Workshop", 2126 },

        { 2230, 54, new DateTime(2025,11,9,15,0,0,DateTimeKind.Utc), new DateTime(2025,11,9,12,0,0,0, DateTimeKind.Utc), "Line Drawing – Main Session", 2127 },
        { 2231, 56, new DateTime(2026,4,14,15,0,0,DateTimeKind.Utc), new DateTime(2026,4,14,12,0,0,0, DateTimeKind.Utc), "Line Drawing – Main Session", 2128 },

        { 2232, 56, new DateTime(2026,1,11,18,0,0,DateTimeKind.Utc), new DateTime(2026,1,11,16,0,0,0, DateTimeKind.Utc), "Procreate Lab – Session 1", 2129 },
        { 2233, 56, new DateTime(2026,1,18,18,0,0,DateTimeKind.Utc), new DateTime(2026,1,18,16,0,0,0, DateTimeKind.Utc), "Procreate Lab – Session 2", 2129 },
        { 2234, 56, new DateTime(2026,1,25,18,0,0,DateTimeKind.Utc), new DateTime(2026,1,25,16,0,0,0, DateTimeKind.Utc), "Procreate Lab – Session 3", 2129 },

        { 2235, 55, new DateTime(2025,11,28,18,0,0,DateTimeKind.Utc), new DateTime(2025,11,28,15,0,0,0, DateTimeKind.Utc), "Comfort Food – Main Workshop", 2130 },
        { 2236, 54, new DateTime(2026,3,20,18,0,0,DateTimeKind.Utc), new DateTime(2026,3,20,15,0,0,0, DateTimeKind.Utc), "Comfort Food – Main Workshop", 2131 }
     };

        private static readonly object[,] SeedEnrollments = new object[,]
  {
    // Photography Basics – Sept 10 2025 (2100) — popularny
    { 1000, null, new DateTime(2025, 8, 20, 9, 0, 0, DateTimeKind.Utc), "Active", 305, 2100 },
    { 1001, null, new DateTime(2025, 8, 22, 11, 0, 0, DateTimeKind.Utc), "Active", 306, 2100 },
    { 1002, null, new DateTime(2025, 8, 25, 14, 0, 0, DateTimeKind.Utc), "Active", 307, 2100 },

    // Photography Basics – Dec 15 2025 (2101)
    { 1003, null, new DateTime(2025, 10, 5, 10, 0, 0, DateTimeKind.Utc), "Active", 308, 2101 },
    { 1004, null, new DateTime(2025, 10, 10, 12, 0, 0, DateTimeKind.Utc), "Active", 309, 2101 },

    // Acrylic Painting – Aug 20 2025 (2102) — odbyty
    { 1005, null, new DateTime(2025, 7, 28, 9, 0, 0, DateTimeKind.Utc), "Active", 310, 2102 },
    { 1006, null, new DateTime(2025, 7, 30, 10, 0, 0, DateTimeKind.Utc), "Active", 311, 2102 },

    // Acrylic Painting – Jan 18 2026 (2103)
    { 1007, null, new DateTime(2025, 12, 1, 11, 0, 0, DateTimeKind.Utc), "Active", 312, 2103 },

    // Creative Writing – Oct 5 2025 (2104)
    { 1008, null, new DateTime(2025, 9, 5, 10, 0, 0, DateTimeKind.Utc), "Active", 313, 2104 },

    // Creative Writing – Feb 10 2026 (2105)
    { 1009, null, new DateTime(2025, 12, 20, 13, 0, 0, DateTimeKind.Utc), "Active", 314, 2105 },

    // Guitar Course – March 2026 (2106) — seria, popularny
    { 1010, null, new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc), "Active", 315, 2106 },
    { 1011, null, new DateTime(2026, 1, 11, 14, 0, 0, DateTimeKind.Utc), "Active", 316, 2106 },
    { 1012, null, new DateTime(2026, 1, 12, 15, 0, 0, DateTimeKind.Utc), "Active", 317, 2106 },

    // Intro Songwriting – Oct 12 2025 (2107)
    { 1013, null, new DateTime(2025, 9, 20, 11, 0, 0, DateTimeKind.Utc), "Active", 318, 2107 },

    // Intro Songwriting – Feb 15 2026 (2117)
    { 1014, null, new DateTime(2025, 12, 28, 10, 0, 0, DateTimeKind.Utc), "Active", 319, 2117 },

    // Expressive Portraits – Nov 5 2025 (2118)
    { 1015, null, new DateTime(2025, 10, 1, 12, 0, 0, DateTimeKind.Utc), "Active", 305, 2118 },
    { 1016, null, new DateTime(2025, 10, 10, 12, 0, 0, DateTimeKind.Utc), "Active", 306, 2118 },

    // DSL – Sept 18 2025 (2120)
    { 1017, null, new DateTime(2025, 8, 25, 9, 0, 0, DateTimeKind.Utc), "Active", 307, 2120 },

    // Ceramic Mugs – Feb 2026 Series (2123)
    { 1018, null, new DateTime(2026, 1, 10, 15, 0, 0, DateTimeKind.Utc), "Active", 308, 2123 },

    // Embroidery – Oct 18 2025 (2125)
    { 1019, null, new DateTime(2025, 9, 10, 9, 0, 0, DateTimeKind.Utc), "Active", 309, 2125 },

    // Line Drawing – Nov 9 2025 (2127)
    { 1020, null, new DateTime(2025, 10, 1, 10, 0, 0, DateTimeKind.Utc), "Active", 310, 2127 },

    // Procreate Lab – Jan 2026 (2129)
    { 1021, null, new DateTime(2025, 12, 20, 16, 0, 0, DateTimeKind.Utc), "Active", 311, 2129 },

    // Comfort Food – Nov 28 2025 (2130)
    { 1022, null, new DateTime(2025, 10, 12, 11, 0, 0, DateTimeKind.Utc), "Active", 312, 2130 },

    // Comfort Food – Mar 20 2026 (2131)
    { 1023, null, new DateTime(2026, 1, 15, 12, 0, 0, DateTimeKind.Utc), "Active", 313, 2131 }
  };



        private static readonly object[,] SeedPayments = new object[,]
        {
    { 1000, 1000, 190.00m, "Paid",    null, null, new DateTime(2025, 8, 20, 9, 0, 0, DateTimeKind.Utc), new DateTime(2025, 8, 20, 9, 0, 0, DateTimeKind.Utc) },
    { 1001, 1001, 190.00m, "Paid",    null, null, new DateTime(2025, 8, 22, 11, 0, 0, DateTimeKind.Utc), new DateTime(2025, 8, 22, 11, 0, 0, DateTimeKind.Utc) },
    { 1002, 1002, 190.00m, "Paid",    null, null, new DateTime(2025, 8, 25, 14, 0, 0, DateTimeKind.Utc), new DateTime(2025, 8, 25, 14, 0, 0, DateTimeKind.Utc) },

    { 1003, 1003, 190.00m, "Paid",    null, null, new DateTime(2025, 10, 5, 10, 0, 0, DateTimeKind.Utc), new DateTime(2025, 10, 5, 10, 0, 0, DateTimeKind.Utc) },
    { 1004, 1004, 190.00m, "Paid",    null, null, new DateTime(2025, 10, 10, 12, 0, 0, DateTimeKind.Utc), new DateTime(2025, 10, 10, 12, 0, 0, DateTimeKind.Utc) },

    { 1005, 1005, 150.00m, "Paid",    null, null, new DateTime(2025, 7, 28, 9, 0, 0, DateTimeKind.Utc), new DateTime(2025, 7, 28, 9, 0, 0, DateTimeKind.Utc) },
    { 1006, 1006, 150.00m, "Paid",    null, null, new DateTime(2025, 7, 30, 10, 0, 0, DateTimeKind.Utc), new DateTime(2025, 7, 30, 10, 0, 0, DateTimeKind.Utc) },

    { 1007, 1007, 150.00m, "Pending", null, null, null, new DateTime(2025, 12, 1, 11, 0, 0, DateTimeKind.Utc) },

    { 1008, 1008, 130.00m, "Paid",    null, null, new DateTime(2025, 9, 5, 10, 0, 0, DateTimeKind.Utc), new DateTime(2025, 9, 5, 10, 0, 0, DateTimeKind.Utc) },

    { 1009, 1009, 130.00m, "Pending", null, null, null, new DateTime(2025, 12, 20, 13, 0, 0, DateTimeKind.Utc) },

    { 1010, 1010, 480.00m, "Pending", null, null, null, new DateTime(2026, 1, 10, 12, 0, 0, DateTimeKind.Utc) },
    { 1011, 1011, 480.00m, "Pending", null, null, null, new DateTime(2026, 1, 11, 14, 0, 0, DateTimeKind.Utc) },
    { 1012, 1012, 480.00m, "Pending", null, null, null, new DateTime(2026, 1, 12, 15, 0, 0, DateTimeKind.Utc) },

    { 1013, 1013, 180.00m, "Paid",    null, null, new DateTime(2025, 9, 20, 11, 0, 0, DateTimeKind.Utc), new DateTime(2025, 9, 20, 11, 0, 0, DateTimeKind.Utc) },

    { 1014, 1014, 180.00m, "Pending", null, null, null, new DateTime(2025, 12, 28, 10, 0, 0, DateTimeKind.Utc) },

    { 1015, 1015, 190.00m, "Paid",    null, null, new DateTime(2025, 10, 1, 12, 0, 0, DateTimeKind.Utc), new DateTime(2025, 10, 1, 12, 0, 0, DateTimeKind.Utc) },
    { 1016, 1016, 190.00m, "Paid",    null, null, new DateTime(2025, 10, 10, 12, 0, 0, DateTimeKind.Utc), new DateTime(2025, 10, 10, 12, 0, 0, DateTimeKind.Utc) },

    { 1017, 1017, 200.00m, "Paid",    null, null, new DateTime(2025, 8, 25, 9, 0, 0, DateTimeKind.Utc), new DateTime(2025, 8, 25, 9, 0, 0, DateTimeKind.Utc) },

    { 1018, 1018, 520.00m, "Pending", null, null, null, new DateTime(2026, 1, 10, 15, 0, 0, DateTimeKind.Utc) },

    { 1019, 1019, 150.00m, "Paid",    null, null, new DateTime(2025, 9, 10, 9, 0, 0, DateTimeKind.Utc), new DateTime(2025, 9, 10, 9, 0, 0, DateTimeKind.Utc) },

    { 1020, 1020, 160.00m, "Paid",    null, null, new DateTime(2025, 10, 1, 10, 0, 0, DateTimeKind.Utc), new DateTime(2025, 10, 1, 10, 0, 0, DateTimeKind.Utc) },

    { 1021, 1021, 360.00m, "Pending", null, null, null, new DateTime(2025, 12, 20, 16, 0, 0, DateTimeKind.Utc) },

    { 1022, 1022, 220.00m, "Paid",    null, null, new DateTime(2025, 10, 12, 11, 0, 0, DateTimeKind.Utc), new DateTime(2025, 10, 12, 11, 0, 0, DateTimeKind.Utc) },

    { 1023, 1023, 220.00m, "Pending", null, null, null, new DateTime(2026, 1, 15, 12, 0, 0, DateTimeKind.Utc) }
        };



        private static readonly object[,] SeedReviews = new object[,]
{
    { 4000, "Great introduction, very clear explanations!", new DateTime(2025, 9, 12, 10, 0, 0, DateTimeKind.Utc), 5, 305, 2000 },
    { 4001, "Good workshop, learned a lot.",                 new DateTime(2025, 9, 13, 10, 0, 0, DateTimeKind.Utc), 4, 306, 2000 },
    { 4002, "Amazing! Loved the hands-on parts.",            new DateTime(2025, 9, 14, 10, 0, 0, DateTimeKind.Utc), 5, 307, 2000 },

    { 4003, "Interesting techniques, helpful teacher.",      new DateTime(2025, 8, 25, 12, 0, 0, DateTimeKind.Utc), 4, 310, 2001 },
    { 4004, "Loved the creative atmosphere!",                new DateTime(2025, 8, 26, 12, 0, 0, DateTimeKind.Utc), 5, 311, 2001 },

    { 4005, "Inspiring and very engaging.",                  new DateTime(2025, 10, 10, 12, 0, 0, DateTimeKind.Utc), 5, 313, 2002 },

    { 4006, "Fun and practical songwriting basics.",         new DateTime(2025, 10, 15, 12, 0, 0, DateTimeKind.Utc), 4, 318, 2004 },

    { 4007, "Great portrait techniques, very useful!",        new DateTime(2025, 11, 10, 12, 0, 0, DateTimeKind.Utc), 5, 305, 2005 },
    { 4008, "Good pace, friendly instructor.",                new DateTime(2025, 11, 11, 12, 0, 0, DateTimeKind.Utc), 4, 306, 2005 },

    { 4009, "Learned new tricks for composition.",            new DateTime(2025, 9, 20, 12, 0, 0, DateTimeKind.Utc), 4, 307, 2006 },

    { 4010, "Loved the embroidery patterns provided!",        new DateTime(2025, 10, 19, 12, 0, 0, DateTimeKind.Utc), 5, 309, 2008 },

    { 4011, "Relaxing creative workshop, well led.",          new DateTime(2025, 11, 15, 12, 0, 0, DateTimeKind.Utc), 4, 310, 2009 },

    { 4012, "Delicious recipes, great energy!",               new DateTime(2025, 11, 29, 12, 0, 0, DateTimeKind.Utc), 5, 312, 2011 }
};



        private static readonly string[] EnrollmentUserCycleColumns = new[] { "UserId", "WorkshopCycleId" };

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Addresses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    City = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Street = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    BuildingNumber = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Room = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    AdditionalInfo = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Addresses", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FirstName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    LastName = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Email = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PasswordHash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Logs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Details = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Logs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Logs_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "UserRoles",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    RoleId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_UserRoles_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserRoles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Workshops",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    IsSeries = table.Column<bool>(type: "bit", nullable: false),
                    Price = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MaxParticipants = table.Column<int>(type: "int", nullable: false),
                    AverageRating = table.Column<decimal>(type: "decimal(5,2)", precision: 5, scale: 2, nullable: true),
                    ImageUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ThumbnailUrl = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CategoryId = table.Column<int>(type: "int", nullable: false),
                    AddressId = table.Column<int>(type: "int", nullable: false),
                    DefaultInstructorId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Workshops", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Workshops_Addresses_AddressId",
                        column: x => x.AddressId,
                        principalTable: "Addresses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Workshops_Categories_CategoryId",
                        column: x => x.CategoryId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Workshops_Users_DefaultInstructorId",
                        column: x => x.DefaultInstructorId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Reviews",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    WorkshopId = table.Column<int>(type: "int", nullable: false),
                    Rating = table.Column<int>(type: "int", nullable: false),
                    Comment = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reviews", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Reviews_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Reviews_Workshops_WorkshopId",
                        column: x => x.WorkshopId,
                        principalTable: "Workshops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "WorkshopCycles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkshopId = table.Column<int>(type: "int", nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StartDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsOpenForEnrollment = table.Column<bool>(type: "bit", nullable: false),
                    MaxParticipantsOverride = table.Column<int>(type: "int", nullable: true),
                    AddressId = table.Column<int>(type: "int", nullable: true),
                    InstructorOverrideId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkshopCycles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkshopCycles_Addresses_AddressId",
                        column: x => x.AddressId,
                        principalTable: "Addresses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkshopCycles_Users_InstructorOverrideId",
                        column: x => x.InstructorOverrideId,
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_WorkshopCycles_Workshops_WorkshopId",
                        column: x => x.WorkshopId,
                        principalTable: "Workshops",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Enrollments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    WorkshopCycleId = table.Column<int>(type: "int", nullable: false),
                    EnrolledAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CancelledAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Enrollments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Enrollments_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Enrollments_WorkshopCycles_WorkshopCycleId",
                        column: x => x.WorkshopCycleId,
                        principalTable: "WorkshopCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "InstructorAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkshopId = table.Column<int>(type: "int", nullable: true),
                    WorkshopCycleId = table.Column<int>(type: "int", nullable: true),
                    WorkshopSessionId = table.Column<int>(type: "int", nullable: true),
                    InstructorId = table.Column<int>(type: "int", nullable: false),
                    IsLead = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InstructorAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InstructorAssignments_Users_InstructorId",
                        column: x => x.InstructorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InstructorAssignments_WorkshopCycles_WorkshopCycleId",
                        column: x => x.WorkshopCycleId,
                        principalTable: "WorkshopCycles",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "WorkshopSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    WorkshopCycleId = table.Column<int>(type: "int", nullable: false),
                    Topic = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    StartTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AddressId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WorkshopSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_WorkshopSessions_Addresses_AddressId",
                        column: x => x.AddressId,
                        principalTable: "Addresses",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_WorkshopSessions_WorkshopCycles_WorkshopCycleId",
                        column: x => x.WorkshopCycleId,
                        principalTable: "WorkshopCycles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Payments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EnrollmentId = table.Column<int>(type: "int", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Method = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ExternalPaymentId = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    PaidAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Payments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Payments_Enrollments_EnrollmentId",
                        column: x => x.EnrollmentId,
                        principalTable: "Enrollments",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

#pragma warning disable CA1861 // EF Core InsertData requires multidimensional arrays; using static readonly fields already
            migrationBuilder.InsertData(
                table: "Addresses",
                columns: new[] { "Id", "AdditionalInfo", "BuildingNumber", "City", "Room", "Street" },
                values: SeedAddresses);
            migrationBuilder.InsertData(
                table: "Categories",
                columns: new[] { "Id", "Description", "Name" },
                values: SeedCategories);
            migrationBuilder.InsertData(
                table: "Roles",
                columns: new[] { "Id", "Description", "Name" },
                values: SeedRoles);
            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "CreatedAt", "Email", "FirstName", "LastName", "PasswordHash" },
                values: SeedUsers);
            migrationBuilder.InsertData(
                table: "UserRoles",
                columns: new[] { "RoleId", "UserId" },
                values: SeedUserRoles);
            migrationBuilder.InsertData(
                table: "Workshops",
                columns: new[] { "Id", "AddressId", "AverageRating", "CategoryId", "DefaultInstructorId", "Description", "ImageUrl", "IsSeries", "MaxParticipants", "Price", "ThumbnailUrl", "Title" },
                values: SeedWorkshops);
            migrationBuilder.InsertData(
                table: "Reviews",
                columns: new[] { "Id", "Comment", "CreatedAt", "Rating", "UserId", "WorkshopId" },
                values: SeedReviews);
            migrationBuilder.InsertData(
                table: "WorkshopCycles",
                columns: new[] { "Id", "AddressId", "DisplayName", "EndDate", "InstructorOverrideId", "IsOpenForEnrollment", "MaxParticipantsOverride", "StartDate", "WorkshopId" },
                values: SeedCycles);
            migrationBuilder.InsertData(
                table: "Enrollments",
                columns: new[] { "Id", "CancelledAt", "EnrolledAt", "Status", "UserId", "WorkshopCycleId" },
                values: SeedEnrollments);
            migrationBuilder.InsertData(
                table: "WorkshopSessions",
                columns: new[] { "Id", "AddressId", "EndTime", "StartTime", "Topic", "WorkshopCycleId" },
                values: SeedWorkshopSessions);
            migrationBuilder.InsertData(
    table: "Payments",
    columns: new[]
    {
        "Id",
        "EnrollmentId",
        "Amount",
        "Status",
        "Method",
        "ExternalPaymentId",
        "PaidAt",
        "CreatedAt"
    },
    values: SeedPayments);

            // Recalculate AverageRating for seeded workshops based on seeded Reviews.
            // This updates Workshop.AverageRating with the rounded average of Ratings from Reviews.
            migrationBuilder.Sql(@"
                UPDATE w
                SET AverageRating = t.AvgRating
                FROM dbo.Workshops w
                INNER JOIN (
                    SELECT WorkshopId, ROUND(AVG(CAST(Rating AS DECIMAL(5,2))), 2) AS AvgRating
                    FROM dbo.Reviews
                    GROUP BY WorkshopId
                ) t ON w.Id = t.WorkshopId;

                UPDATE dbo.Workshops
                SET AverageRating = NULL
                WHERE Id NOT IN (SELECT DISTINCT WorkshopId FROM dbo.Reviews);
            ");


#pragma warning restore CA1861

            // Replace array column parameters with overloads or static arrays to avoid CA1861 warnings
            migrationBuilder.CreateIndex(
                name: "IX_Enrollments_UserId_WorkshopCycleId",
                table: "Enrollments",
                columns: EnrollmentUserCycleColumns,
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Enrollments_WorkshopCycleId",
                table: "Enrollments",
                column: "WorkshopCycleId");

            migrationBuilder.CreateIndex(
                name: "IX_InstructorAssignments_InstructorId",
                table: "InstructorAssignments",
                column: "InstructorId");

            migrationBuilder.CreateIndex(
                name: "IX_InstructorAssignments_WorkshopCycleId",
                table: "InstructorAssignments",
                column: "WorkshopCycleId");

            migrationBuilder.CreateIndex(
                name: "IX_InstructorAssignments_WorkshopId",
                table: "InstructorAssignments",
                column: "WorkshopId");

            migrationBuilder.CreateIndex(
                name: "IX_InstructorAssignments_WorkshopSessionId",
                table: "InstructorAssignments",
                column: "WorkshopSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_Logs_UserId",
                table: "Logs",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_EnrollmentId",
                table: "Payments",
                column: "EnrollmentId");

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_UserId",
                table: "Reviews",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_WorkshopId",
                table: "Reviews",
                column: "WorkshopId");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_RoleId",
                table: "UserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkshopCycles_AddressId",
                table: "WorkshopCycles",
                column: "AddressId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkshopCycles_InstructorOverrideId",
                table: "WorkshopCycles",
                column: "InstructorOverrideId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkshopCycles_WorkshopId",
                table: "WorkshopCycles",
                column: "WorkshopId");

            migrationBuilder.CreateIndex(
                name: "IX_Workshops_AddressId",
                table: "Workshops",
                column: "AddressId");

            migrationBuilder.CreateIndex(
                name: "IX_Workshops_CategoryId",
                table: "Workshops",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Workshops_DefaultInstructorId",
                table: "Workshops",
                column: "DefaultInstructorId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkshopSessions_AddressId",
                table: "WorkshopSessions",
                column: "AddressId");

            migrationBuilder.CreateIndex(
                name: "IX_WorkshopSessions_WorkshopCycleId",
                table: "WorkshopSessions",
                column: "WorkshopCycleId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InstructorAssignments");

            migrationBuilder.DropTable(
                name: "Logs");

            migrationBuilder.DropTable(
                name: "Payments");

            migrationBuilder.DropTable(
                name: "Reviews");

            migrationBuilder.DropTable(
                name: "UserRoles");

            migrationBuilder.DropTable(
                name: "WorkshopSessions");

            migrationBuilder.DropTable(
                name: "Enrollments");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropTable(
                name: "WorkshopCycles");

            migrationBuilder.DropTable(
                name: "Workshops");

            migrationBuilder.DropTable(
                name: "Addresses");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}

