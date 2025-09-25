require('dotenv').config();
const { getDb, readJson, writeJson } = require('./db/adapter');

const lots = [
    {id:2, name:'Lot 2', status:'available', born:'Nov 2022', weight:'N/A', color:'Light Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot2.jpeg', '/uploads/lot2full.jpeg'], video:'/uploads/lot2video.mp4'},
    {id:5, name:'Lot 5', status:'available', born:'Dec 2022', weight:'N/A', color:'Dark Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot5.jpeg', '/uploads/lot5full.jpeg'], video:''},
    {id:6, name:'Lot 6', status:'available', born:'Jan 2023', weight:'N/A', color:'White', health:'Excellent', bloodline:'Premium', images:['/uploads/lot6.jpeg', '/uploads/lot6full.jpeg'], video:''},
    {id:7, name:'Lot 7', status:'available', born:'Nov 2022', weight:'N/A', color:'Light Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot7.jpeg', '/uploads/lot7full.jpeg'], video:'/uploads/Lot%207.mp4'},
    {id:12, name:'Lot 12', status:'available', born:'Feb 2023', weight:'N/A', color:'Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot12.jpeg', '/uploads/lot12full.jpeg'], video:''},
    {id:13, name:'Lot 13', status:'available', born:'Mar 2023', weight:'N/A', color:'Light Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot13.jpeg', '/uploads/lot13full.jpeg'], video:''},
    {id:14, name:'Lot 14', status:'available', born:'Apr 2023', weight:'N/A', color:'Dark Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot14.jpeg', '/uploads/lot14full.jpeg'], video:''},
    {id:15, name:'Lot 15', status:'available', born:'May 2023', weight:'N/A', color:'White', health:'Excellent', bloodline:'Premium', images:['/uploads/lot15.jpeg', '/uploads/lot15full.jpeg'], video:''},
    {id:17, name:'Lot 17', status:'available', born:'Jun 2023', weight:'N/A', color:'Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot17.jpeg', '/uploads/lot17full.jpeg'], video:'/uploads/Lot%2017.mp4'},
    {id:18, name:'Lot 18', status:'available', born:'Jul 2023', weight:'N/A', color:'Light Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot18.jpeg', '/uploads/lot18full.jpeg'], video:''},
    {id:19, name:'Lot 19', status:'available', born:'Aug 2023', weight:'N/A', color:'Dark Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot19.jpeg', '/uploads/lot19full.jpeg'], video:'/uploads/Lot%2019.mp4'},
    {id:20, name:'Lot 20', status:'available', born:'Sep 2023', weight:'N/A', color:'White', health:'Excellent', bloodline:'Premium', images:['/uploads/lot20.jpeg', '/uploads/lot20full.jpeg'], video:''},
    {id:21, name:'Lot 21', status:'available', born:'Oct 2023', weight:'N/A', color:'Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot21.jpeg', '/uploads/lot21full.jpeg'], video:'/uploads/Lot%2021.mp4'},
    {id:22, name:'Lot 22', status:'available', born:'Nov 2023', weight:'N/A', color:'Light Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot22.jpeg', '/uploads/lot22full.jpeg'], video:''},
    {id:23, name:'Lot 23', status:'available', born:'Dec 2023', weight:'N/A', color:'Dark Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot23.jpeg', '/uploads/lot23full.jpeg'], video:'/uploads/Lot%2023.mp4'},
    {id:24, name:'Lot 24', status:'available', born:'Jan 2024', weight:'N/A', color:'White', health:'Excellent', bloodline:'Premium', images:['/uploads/lot24.jpeg', '/uploads/lot24full.jpeg'], video:'/uploads/Lot%2024.mp4'},
    {id:26, name:'Lot 26', status:'available', born:'Feb 2024', weight:'N/A', color:'Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot26.jpeg', '/uploads/lot26full.jpeg'], video:'/uploads/Lot%2026.mp4'},
    {id:28, name:'Lot 28', status:'available', born:'Mar 2024', weight:'N/A', color:'Light Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot28.jpeg'], video:'/uploads/Lot%2028.mp4'},
    {id:29, name:'Lot 29', status:'available', born:'Apr 2024', weight:'N/A', color:'Dark Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot29.jpeg', '/uploads/lot29full.jpeg'], video:'/uploads/Lot%2029.mp4'},
    {id:30, name:'Lot 30', status:'available', born:'May 2024', weight:'N/A', color:'White', health:'Excellent', bloodline:'Premium', images:['/uploads/lot30.jpeg', '/uploads/lot30full.jpeg'], video:'/uploads/Lot%2030.mp4'},
    {id:31, name:'Lot 31', status:'available', born:'Jun 2024', weight:'N/A', color:'Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot31.jpeg', '/uploads/lot31full.jpeg'], video:'/uploads/Lot%2031.mp4'},
    {id:33, name:'Lot 33', status:'available', born:'Jul 2024', weight:'N/A', color:'Light Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot33full.jpeg'], video:'/uploads/Lot%2033.mp4'},
    {id:34, name:'Lot 34', status:'available', born:'Aug 2024', weight:'N/A', color:'Dark Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot34.jpeg', '/uploads/lot34full.jpeg'], video:'/uploads/Lot%2034.mp4'},
    {id:35, name:'Lot 35', status:'available', born:'Sep 2024', weight:'N/A', color:'White', health:'Excellent', bloodline:'Premium', images:['/uploads/lot35.jpeg', '/uploads/lot35full.jpeg'], video:''},
    {id:38, name:'Lot 38', status:'available', born:'Oct 2024', weight:'N/A', color:'Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot38.jpeg', '/uploads/lot38full.jpeg'], video:'/uploads/Lot%2038.mp4'},
    {id:40, name:'Lot 40', status:'available', born:'Nov 2024', weight:'N/A', color:'Light Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot40.jpeg', '/uploads/lot40full.jpeg'], video:'/uploads/Lot%2040.mp4'},
    {id:41, name:'Lot 41', status:'available', born:'Dec 2024', weight:'N/A', color:'Dark Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot41.jpeg', '/uploads/lot41full.jpeg'], video:''},
    {id:43, name:'Lot 43', status:'available', born:'Jan 2025', weight:'N/A', color:'White', health:'Excellent', bloodline:'Premium', images:['/uploads/lot43.jpeg', '/uploads/lot43full.jpeg'], video:'/uploads/Lot%2043.mp4'},
    {id:47, name:'Lot 47', status:'available', born:'Feb 2025', weight:'N/A', color:'Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot47.jpeg', '/uploads/lot47full.jpeg'], video:''},
    {id:48, name:'Lot 48', status:'available', born:'Mar 2025', weight:'N/A', color:'Light Brown', health:'Excellent', bloodline:'Premium', images:['/uploads/lot48.jpeg', '/uploads/lot48full.jpeg'], video:'/uploads/Lot%2048.mp4'}
];

async function seedRams() {
    const db = await getDb();
    if (false) { // Force seeding to JSON
        console.log('Seeding rams to database...');
        for (const lot of lots) {
            try {
                const [result] = await db.execute(
                    'INSERT INTO rams (id, name, status, born_date, weight_kg, color, health_status, bloodline) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), status=VALUES(status), born_date=VALUES(born_date), weight_kg=VALUES(weight_kg), color=VALUES(color), health_status=VALUES(health_status), bloodline=VALUES(bloodline)',
                    [lot.id, lot.name, lot.status, lot.born, lot.weight === 'N/A' ? null : lot.weight, lot.color, lot.health, lot.bloodline]
                );
                console.log(`Seeded ram ${lot.name} with ID ${lot.id}`);

                // Insert media
                for (const img of lot.images) {
                    await db.execute(
                        'INSERT INTO media (parent_type, parent_id, media_type, url) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE url=VALUES(url)',
                        ['ram', lot.id, 'image', img]
                    );
                }
                if (lot.video) {
                    await db.execute(
                        'INSERT INTO media (parent_type, parent_id, media_type, url) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE url=VALUES(url)',
                        ['ram', lot.id, 'video', lot.video]
                    );
                }
            } catch (e) {
                console.error(`Error seeding ram ${lot.name}:`, e.message);
            }
        }
        console.log('Database seeding complete.');
    } else {
        console.log('No database connection, seeding to JSON...');
        const existing = readJson('rams.json');
        const existingIds = new Set(existing.map(r => r.id));
        for (const lot of lots) {
            if (!existingIds.has(String(lot.id))) {
                existing.push({
                    id: String(lot.id),
                    name: lot.name,
                    status: lot.status,
                    bornDate: lot.born,
                    weightKg: lot.weight === 'N/A' ? null : lot.weight,
                    color: lot.color,
                    healthStatus: lot.health,
                    bloodline: lot.bloodline,
                    media: lot.images.map(img => ({ type: 'image', url: img })).concat(lot.video ? [{ type: 'video', url: lot.video }] : []),
                    createdAt: new Date().toISOString()
                });
            }
        }
        writeJson('rams.json', existing);
        console.log('JSON seeding complete.');
    }
}

seedRams().catch(console.error);
