const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configurare dimensiuni
const LARGIME = 450; // 450px lățime
const INALTIME = 300; // 300px înălțime
const CALITATE = 85; // calitate JPEG

// Calea către folderul cu imagini
const caleGalerie = path.join(__dirname, 'resurse', 'imagini', 'galerie');

// Funcție pentru redimensionarea unei imagini
async function redimensioneazaImagine(caleIntrare, caleIesire) {
  try {
    await sharp(caleIntrare)
      .resize(LARGIME, INALTIME, {
        fit: 'cover', // crop pentru a păstra aspect ratio
        position: 'center' // centru pentru crop
      })
      .jpeg({ quality: CALITATE })
      .toFile(caleIesire);
    
    console.log(`✓ Redimensionat: ${path.basename(caleIntrare)}`);
  } catch (error) {
    console.error(`✗ Eroare la redimensionarea ${path.basename(caleIntrare)}:`, error.message);
  }
}

// Funcție principală
async function redimensioneazaToateImaginile() {
  console.log('🖼️  Începe redimensionarea imaginilor...');
  console.log(`📏 Dimensiuni: ${LARGIME}x${INALTIME}px`);
  console.log(`🎯 Calitate: ${CALITATE}%\n`);
  
  try {
    // Citește toate fișierele JPG din folder
    const fisiere = fs.readdirSync(caleGalerie)
      .filter(fisier => fisier.toLowerCase().endsWith('.jpg'))
      .sort((a, b) => {
        // Sortează numeric (imagine1.jpg, imagine2.jpg, etc.)
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
      });
    
    console.log(`📁 Găsite ${fisiere.length} imagini pentru redimensionare\n`);
    
    // Creează folderul pentru backup
    const caleBackup = path.join(caleGalerie, 'backup');
    if (!fs.existsSync(caleBackup)) {
      fs.mkdirSync(caleBackup);
      console.log('📦 Folder backup creat\n');
    }
    
    // Procesează fiecare imagine
    for (const fisier of fisiere) {
      const caleIntrare = path.join(caleGalerie, fisier);
      const caleBackupFisier = path.join(caleBackup, fisier);
      const caleTemp = path.join(caleGalerie, `temp_${fisier}`);
      
      // Fă backup la imaginea originală
      if (!fs.existsSync(caleBackupFisier)) {
        fs.copyFileSync(caleIntrare, caleBackupFisier);
      }
      
      // Redimensionează imaginea într-un fișier temporar
      await redimensioneazaImagine(caleIntrare, caleTemp);
      
      // Înlocuiește fișierul original cu cel redimensionat
      fs.unlinkSync(caleIntrare);
      fs.renameSync(caleTemp, caleIntrare);
    }
    
    console.log('\n✅ Redimensionarea completă!');
    console.log(`📦 Backup-urile sunt în: ${caleBackup}`);
    console.log(`📏 Toate imaginile au acum dimensiunea: ${LARGIME}x${INALTIME}px`);
    
  } catch (error) {
    console.error('❌ Eroare:', error.message);
  }
}

// Rulează scriptul
redimensioneazaToateImaginile(); 