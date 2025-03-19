const mqtt = require('mqtt');
const WebSocket = require('ws');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const wss = new WebSocket.Server({ port: 8080 });

wss.on('connection', (ws) => {
    console.log('🔗 [SERVER] Client WebSocket terhubung');

    ws.on('message', (message) => {
        console.log("📥 [SERVER] Data kontrol diterima:", message.toString());

        try {
            const controlData = JSON.parse(message.toString());
            console.log("✅ [SERVER] Data parsing berhasil:", controlData);

            if (!controlData.sensorDatas || !Array.isArray(controlData.sensorDatas)) {
                console.error("❌ [SERVER] Format data kontrol tidak valid!", controlData);
                return;
            }

            const mqttPayload = JSON.stringify(controlData);
            const topic = 'test*'; 

            console.log(`📤 [SERVER] Mengirim ke MQTT (${topic}):`, mqttPayload);

            client.publish(topic, mqttPayload, { qos: 1 }, (err) => {
                if (err) {
                    console.error('❌ [SERVER] Gagal mengirim ke MQTT:', err);
                } else {
                    console.log(`✅ [SERVER] Data berhasil dikirim ke MQTT (${topic}):`, mqttPayload);
                }
            });

        } catch (error) {
            console.error("❌ [SERVER] Error parsing JSON kontrol:", error);
        }
    });
});

const options = {
    key: fs.readFileSync('./certs/aws-private.pem.key'),
    cert: fs.readFileSync('./certs/aws-certificate.pem.crt'),
    ca: fs.readFileSync('./certs/AmazonRootCA1.pem'),
    protocol: 'mqtts'
};

const client = mqtt.connect(process.env.MQTT_BROKER_URL, options);

client.on('connect', () => {
    console.log('✅ Terhubung ke AWS IoT Core');
    const topic = process.env.MQTT_TOPIC || 'mqttout';
    client.subscribe(topic, (err) => {
        if (!err) console.log(`📩 Berhasil subscribe ke topik: ${topic}`);
        else console.error('❌ Gagal subscribe:', err);
    });
});

client.on('message', (topic, message) => {
    console.log(`📨 [SERVER] Data diterima dari ${topic}:`, message.toString());

    try {
        let rawData = JSON.parse(message.toString());

        if (!rawData.sensorDatas || !Array.isArray(rawData.sensorDatas)) {
            throw new Error("sensorDatas tidak ditemukan atau bukan array!");
        }

        let formattedData = rawData.sensorDatas.map(sensor => {
            return { flag: sensor.flag, value: sensor.switcher };
        });

        console.log("📤 [SERVER] Data dikirim ke WebSocket:", formattedData);

        wss.clients.forEach((ws) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify(formattedData));
            }
        });

    } catch (error) {
        console.error("❌ [SERVER] Error parsing JSON:", error);
    }
});

client.on('error', (error) => console.error('❌ MQTT Error:', error));
client.on('close', () => console.log('🔌 Koneksi MQTT tertutup'));
