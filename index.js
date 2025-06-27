const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const os = require('os');

const PORT = 8080;

// Vector cu numele folderelor de creat
const vect_foldere = ['temp'];

// Configurare dimensiuni pentru diferite ecrane
const DIMENSIUNI_IMAGINI = {
  small: { width: 300, height: 200 },    // Ecran mic (mobile)
  medium: { width: 450, height: 300 },   // Ecran mediu (tablet)
  large: { width: 600, height: 400 }     // Ecran mare (desktop)
};

// Funcție pentru crearea folderelor
function creeazaFoldere() {
  vect_foldere.forEach(numeFolder => {
    const caleFolder = path.join(__dirname, numeFolder);
    
    if (!fs.existsSync(caleFolder)) {
      try {
        fs.mkdirSync(caleFolder, { recursive: true });
        console.log(`Folderul "${numeFolder}" a fost creat cu succes.`);
      } catch (error) {
        console.error(`Eroare la crearea folderului "${numeFolder}":`, error.message);
      }
    } else {
      console.log(`Folderul "${numeFolder}" există deja.`);
    }
  });
}

// Variabilă globală
const obGlobal = {
  obErori: null,
  dateGalerie: null
};

// Funcție pentru inițializarea erorilor
function initErori() {
  try {
    // Citește JSON-ul cu erorile
    const configErori = JSON.parse(fs.readFileSync('erori.json', 'utf8'));
    
    // Creează obiectul cu datele erorilor
    const obErori = {
      cale_baza: configErori.cale_baza,
      eroare_default: {
        ...configErori.eroare_default,
        imagine: path.join(configErori.cale_baza, configErori.eroare_default.imagine)
      },
      info_erori: configErori.info_erori.map(eroare => ({
        ...eroare,
        imagine: path.join(configErori.cale_baza, eroare.imagine)
      }))
    };
    
    // Salvează în variabila globală
    obGlobal.obErori = obErori;
    
    console.log('Erorile au fost încărcate cu succes în memorie');
  } catch (error) {
    console.error('Eroare la încărcarea erorilor:', error.message);
  }
}

// Funcție pentru inițializarea galeriei
function initGalerie() {
  try {
    // Citește JSON-ul cu datele galeriei
    const dateGalerie = JSON.parse(fs.readFileSync('galerie.json', 'utf8'));
    
    // Salvează în variabila globală
    obGlobal.dateGalerie = dateGalerie;
    
    console.log('Datele galeriei au fost încărcate cu succes în memorie');
  } catch (error) {
    console.error('Eroare la încărcarea datelor galeriei:', error.message);
  }
}

// Funcție pentru generarea dinamică a unei imagini
async function genereazaImagineDinamica(numeImagine, dimensiune) {
  const caleGalerie = path.join(__dirname, 'resurse', 'imagini', 'galerie');
  const caleOriginala = path.join(caleGalerie, numeImagine);
  const caleFolder = path.join(caleGalerie, dimensiune);
  const caleIesire = path.join(caleFolder, numeImagine);
  
  try {
    // Verifică dacă imaginea originală există
    if (!fs.existsSync(caleOriginala)) {
      return false;
    }
    
    // Creează folderul dacă nu există
    if (!fs.existsSync(caleFolder)) {
      fs.mkdirSync(caleFolder, { recursive: true });
    }
    
    // Generează imaginea doar dacă nu există deja
    if (!fs.existsSync(caleIesire)) {
      const dimensiuni = DIMENSIUNI_IMAGINI[dimensiune];
      await sharp(caleOriginala)
        .resize(dimensiuni.width, dimensiuni.height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 85 })
        .toFile(caleIesire);
      
      console.log(`🖼️  Generat dinamic: ${dimensiune}/${numeImagine}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Eroare la generarea ${dimensiune}/${numeImagine}:`, error.message);
    return false;
  }
}

// Funcție pentru a verifica dacă ora curentă se află în intervalul specificat
function esteInInterval(intervalTimp) {
  const acum = new Date();
  const oraCurenta = acum.getHours() * 60 + acum.getMinutes(); // în minute
  
  const [startStr, endStr] = intervalTimp.split('-');
  const [startHour, startMin] = startStr.split(':').map(Number);
  const [endHour, endMin] = endStr.split(':').map(Number);
  
  const startMinute = startHour * 60 + startMin;
  const endMinute = endHour * 60 + endMin;
  
  // Tratează cazul când intervalul trece peste miezul nopții
  if (endMinute < startMinute) {
    return oraCurenta >= startMinute || oraCurenta <= endMinute;
  } else {
    return oraCurenta >= startMinute && oraCurenta <= endMinute;
  }
}

function getRandomElements(array, n) {
  // Shuffle array (Fisher-Yates)
  let arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// Funcție pentru a obține imaginile filtrate după ora curentă
function obtineImaginiFiltrate() {
  if (!obGlobal.dateGalerie) {
    return { cale_galerie: '', imagini: [] };
  }
  
  const imaginiFiltrate = obGlobal.dateGalerie.imagini.filter(imagine => 
    esteInInterval(imagine.timp)
  );
  
  if (imaginiFiltrate.length > 10) {
    imaginiFiltrate = getRandomElements(imaginiFiltrate, 10);
  }
  
  return {
    cale_galerie: obGlobal.dateGalerie.cale_galerie,
    imagini: imaginiFiltrate
  };
}

// Funcție pentru a găsi informațiile despre o eroare
function gasesteEroare(identificator) {
  if (!obGlobal.obErori) {
    return null;
  }
  
  return obGlobal.obErori.info_erori.find(eroare => eroare.identificator === identificator) || obGlobal.obErori.eroare_default;
}

// Funcție pentru afișarea erorilor
function afisareEroare(res, identificator = null, titlu = null, text = null, imagine = null) {
  let infoEroare = null;
  let codStatus = 500; // default pentru eroare generică
  
  if (identificator) {
    // Caută eroarea după identificator
    infoEroare = gasesteEroare(identificator);
    if (infoEroare && infoEroare.identificator) {
      codStatus = infoEroare.identificator;
    }
  } else {
    // Folosește eroarea default
    infoEroare = obGlobal.obErori ? obGlobal.obErori.eroare_default : null;
  }
  
  if (!infoEroare) {
    // Fallback dacă nu există date despre erori
    res.status(500).send('Eroare internă a serverului');
    return;
  }
  
  // Construiește obiectul cu datele pentru template
  const dateEroare = {
    titlu: titlu || infoEroare.titlu,
    text: text || infoEroare.text,
    imagine: imagine || infoEroare.imagine,
    codEroare: codStatus
  };
  
  // Randează pagina de eroare
  res.status(codStatus).render('pagini/eroare', dateEroare);
}

// Middleware pentru a afișa IP-ul utilizatorului
app.use((req, res, next) => {
  const ipUtilizator = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || req.connection.socket?.remoteAddress;
  console.log(`IP utilizator: ${ipUtilizator}`);
  
  // Adaugă IP-ul la obiectul request pentru a fi folosit în template-uri
  req.ipUtilizator = ipUtilizator;
  next();
});

// Middleware pentru a trata cererile către fișiere .ejs
app.use((req, res, next) => {
  if (req.path.endsWith('.ejs')) {
    afisareEroare(res, 400);
  } else {
    next();
  }
});

// Inițializează folderele și erorile la pornirea serverului
creeazaFoldere();
initErori();
initGalerie();

// Configurare EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Rută pentru favicon.ico
app.get('/favicon.ico', (req, res) => {
  const faviconPath = path.join(__dirname, 'resurse', 'ico', 'favicon.ico');
  res.sendFile(faviconPath);
});

// Servește fișierele statice din folderul resurse
app.use('/resurse', express.static(path.join(__dirname, 'resurse')));

// Middleware pentru a trata cererile către folderele din /resurse fără fișier specificat
app.use('/resurse', (req, res, next) => {
  // Verifică dacă cererea se termină cu / (folder) sau nu are extensie
  if (req.path.endsWith('/') || !path.extname(req.path)) {
    // Returnează eroarea 403 pentru accesul la foldere
    afisareEroare(res, 403);
  } else {
    next();
  }
});

app.get(['/', '/index', '/home'], async (req, res) => {
  const dateGalerie = obtineImaginiFiltrate();
  
  // Generează imaginile dinamic pentru toate dimensiunile
  if (dateGalerie.imagini.length > 0) {
    for (const imagine of dateGalerie.imagini) {
      await genereazaImagineDinamica(imagine.cale_imagine, 'small');
      await genereazaImagineDinamica(imagine.cale_imagine, 'medium');
      await genereazaImagineDinamica(imagine.cale_imagine, 'large');
    }
  }
  
  res.render('pagini/index', { 
    ipUtilizator: req.ipUtilizator,
    imagini: dateGalerie.imagini,
    cale_galerie: dateGalerie.cale_galerie
  });
});

// Rută pentru pagina dedicată galeriei
app.get('/galerie', async (req, res) => {
  const dateGalerie = obtineImaginiFiltrate();
  
  // Generează imaginile dinamic pentru toate dimensiunile
  if (dateGalerie.imagini.length > 0) {
    for (const imagine of dateGalerie.imagini) {
      await genereazaImagineDinamica(imagine.cale_imagine, 'small');
      await genereazaImagineDinamica(imagine.cale_imagine, 'medium');
      await genereazaImagineDinamica(imagine.cale_imagine, 'large');
    }
  }
  
  res.render('pagini/galerie', { 
    ipUtilizator: req.ipUtilizator,
    imagini: dateGalerie.imagini,
    cale_galerie: dateGalerie.cale_galerie
  });
});

// Rute de test pentru erori
app.get('/test-400', (req, res) => {
  afisareEroare(res, 400);
});

app.get('/test-403', (req, res) => {
  afisareEroare(res, 403);
});

app.get('/test-503', (req, res) => {
  afisareEroare(res, 503);
});

// Test pentru eroare cu date personalizate
app.get('/test-eroare-personalizata', (req, res) => {
  afisareEroare(res, 404, 'Eroare personalizată', 'Acest mesaj este personalizat pentru test.', path.join('/resurse', 'imagini', 'erori', '404.png'));
});

// Test pentru eroare default cu date personalizate
app.get('/test-eroare-default', (req, res) => {
  afisareEroare(res, null, 'Eroare default personalizată', 'Acest mesaj folosește eroarea default dar cu date personalizate.');
});

// Rută generală pentru orice pagină - TREBUIE să fie ultima
app.get('/:pagina', (req, res) => {
  const pagina = req.params.pagina; // Extrage numele paginii din URL
  
  res.render(path.join('pagini', pagina), { ipUtilizator: req.ipUtilizator }, function(eroare, rezultatRandare) {
    if (eroare) {
      if (eroare.message.startsWith('Failed to lookup view')) {
        // Pagina nu există - randează eroarea 404
        afisareEroare(res, 404);
      } else {
        // Altă eroare - randează eroarea generică
        afisareEroare(res, 500);
      }
    } else {
      // Nu sunt erori - trimite rezultatul către client
      res.send(rezultatRandare);
    }
  });
});

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`Serverul rulează pe http://localhost:${PORT}`);
  console.log(`Pentru acces din rețeaua locală: http://${localIp}:${PORT}`);
  console.log("__dirname:", __dirname);
  console.log("__filename:", __filename);
  console.log("process.cwd():", process.cwd());
});

