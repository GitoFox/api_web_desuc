const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const moment = require('moment');
var https = require('https');

const app = express();
const PORT = 443;



// Middleware para parsear el cuerpo de las solicitudes como JSON
app.use(express.json());


const sslOptions = {
  key: fs.readFileSync('/etc/letsencrypt/live/encuestadores.cristianayala.cl/privkey.pem'),
  cert: fs.readFileSync('/etc/letsencrypt/live/encuestadores.cristianayala.cl/fullchain.pem')
};

app.use(cors({
  origin: '*',
  exposedHeaders: 'Referer'
}));

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});


// Ruta para buscar a un encuestador por su RUT
app.get('/encuestadores/:rut', (req, res) => {
  const rut = req.params.rut.trim();

  const results = [];

  fs.createReadStream('encuestadores.csv')
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', () => {
      const encuestador = results.find((encuestador) => encuestador.rut.trim() === rut);

      if (encuestador) {
        let imagenPath = encuestador.imagen;
        let imagenURL;

        if (!imagenPath || imagenPath === 'NA' || imagenPath === '') {
          // Asignar la ruta de la imagen fija cuando no hay imagen disponible
          imagenPath = 'img/Saludando.png';
        }

        imagenURL = 'https://3.209.219.82:3000/img/' + path.basename(imagenPath); // Obtén solo el nombre del archivo de la imagen
        encuestador.imagenURL = imagenURL;

        // Leer y procesar los proyectos del encuestador
        const proyectos = results.filter((proyecto) => proyecto.rut.trim() === rut);
        const currentDate = moment();

        const proyectosActivos = [];
        const proyectosExpirados = [];

        proyectos.forEach((proyecto) => {
          const fechaFin = moment(proyecto.proyecto_fecha_fin, 'M/D/YYYY');
          const estaActivo = currentDate.isSameOrBefore(fechaFin, 'day');

          const proyectoClasificado = {
            nombre: proyecto.proyecto_nom,
            fechaInicio: proyecto.proyecto_fecha_ini,
            fechaFin: proyecto.proyecto_fecha_fin,
          };

          if (estaActivo) {
            proyectosActivos.push(proyectoClasificado);
          } else {
            proyectosExpirados.push(proyectoClasificado);
          }
        });

        encuestador.proyectosActivos = proyectosActivos;
        encuestador.proyectosExpirados = proyectosExpirados;

        // Devolver solo los datos del encuestador y sus proyectos asociados
        res.json(encuestador);
      } else {
        res.status(404).json({ error: 'Encuestador no encontrado' });
      }
    });
});

// Ruta para servir las imágenes de los encuestadores
app.use('/img', express.static(path.join(__dirname, 'img')));

const server = https.createServer(sslOptions, app);

// haces que el servidor escuche en todas las interfaces de red
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});


