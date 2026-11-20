/*
 * AUA — станция MQ-135, Ауэзов мкр-12
 * ESP8266 (NodeMCU / Wemos D1 mini) + MQ-135 -> MQTT (HiveMQ public) -> бэкенд AUA
 *
 * Библиотеки (Менеджер библиотек Arduino IDE):
 *   - PubSubClient (Nick O'Leary)
 * Плата: "NodeMCU 1.0 (ESP-12E Module)" или "LOLIN(WEMOS) D1 R2 & mini", 115200 бод.
 *
 * Подключение:
 *   MQ-135 VCC -> 5V (Vin)      MQ-135 GND -> GND
 *   MQ-135 AO  -> A0
 *   ВАЖНО: на голом ESP8266 вход A0 держит максимум 1.0 В. На NodeMCU и D1 mini
 *   на плате стоит делитель до 3.3 В, поэтому AO от датчика на 5 В нужно пустить
 *   через делитель (например 10 кОм + 4.7 кОм, AO -> 10к -> A0 -> 4.7к -> GND),
 *   иначе ADC упрётся в потолок и показания будут «залипать» на 1023.
 *
 * Формат пакета (его проверяет backend/src/services/mq135Mqtt.ts):
 *   {"location":"...","raw_adc":0..1023 (целое),"voltage":0..5,
 *    "quality_percent":0..100,"status":"..."}
 */

#include <ESP8266WiFi.h>
#include <PubSubClient.h>

// ======== НАСТРОЙКИ: впиши свои ========
const char* WIFI_SSID     = "ВАШ_WIFI";
const char* WIFI_PASSWORD = "ПАРОЛЬ_WIFI";

const char* MQTT_HOST  = "broker.hivemq.com";
const uint16_t MQTT_PORT = 1883;
const char* MQTT_TOPIC = "almaty/auezov/mkr12/station1/air";  // = MQ135_TOPIC на бэкенде
const char* LOCATION   = "Auezov mkr-12";

// true = станция подключена к ноутбуку по USB и работает без Wi-Fi и MQTT.
// Бэкенд на ноутбуке читает пакеты прямо из порта (MQ135_SERIAL_PORT в backend/.env).
// Для защиты, где нет интернета, ставь true. Для работы через интернет — false.
const bool USB_ONLY = true;

const unsigned long PUBLISH_EVERY_MS = 15000;   // бэкенд считает станцию офлайн после 15 минут тишины
const unsigned long WARMUP_MS        = 120000;  // MQ-135 нужно прогреться; первые 2 минуты помечаем
const float ADC_REF_VOLT = 3.3f;                // напряжение на A0 при 1023 (NodeMCU/D1 mini с делителем)
// =======================================

WiFiClient wifi;
PubSubClient mqtt(wifi);

unsigned long lastPublish = 0;
unsigned long bootAt = 0;

static void log(const char* s) { Serial.println(s); }

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.printf("[wifi] connecting to %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[wifi] OK, ip=%s rssi=%d\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
  } else {
    Serial.printf("[wifi] FAILED, status=%d (1=нет сети, 4=неверный пароль)\n", WiFi.status());
  }
}

void connectMqtt() {
  if (mqtt.connected() || WiFi.status() != WL_CONNECTED) return;
  String clientId = String("aua-mq135-") + String(ESP.getChipId(), HEX);
  Serial.printf("[mqtt] connecting to %s:%u as %s ... ", MQTT_HOST, MQTT_PORT, clientId.c_str());
  if (mqtt.connect(clientId.c_str())) {
    Serial.println("OK");
  } else {
    Serial.printf("FAILED rc=%d (-2=нет связи с брокером)\n", mqtt.state());
  }
}

int readAdcAveraged() {
  long sum = 0;
  const int n = 20;
  for (int i = 0; i < n; i++) {
    sum += analogRead(A0);
    delay(5);
  }
  return (int)(sum / n);
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println();
  log("=== AUA MQ-135 station ===");
  bootAt = millis();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(256);
  mqtt.setKeepAlive(30);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  if (USB_ONLY) {
    WiFi.mode(WIFI_OFF);
    log("[usb] режим USB: Wi-Fi выключен, пакеты идут в порт");
  } else {
    connectWifi();
  }
}

void loop() {
  if (!USB_ONLY) {
    connectWifi();
    connectMqtt();
    mqtt.loop();
  }

  if (millis() - lastPublish < PUBLISH_EVERY_MS) return;
  lastPublish = millis();

  int raw = readAdcAveraged();
  if (raw < 0) raw = 0;
  if (raw > 1023) raw = 1023;

  float voltage = raw * ADC_REF_VOLT / 1023.0f;
  if (voltage > 5.0f) voltage = 5.0f;

  // Условная шкала: чем выше сигнал MQ-135, тем хуже воздух. Это не калибровка в ppm,
  // а понятная 0..100% «чистота»; точные значения считает бэкенд из raw_adc.
  float quality = 100.0f - (raw * 100.0f / 1023.0f);
  if (quality < 0) quality = 0;
  if (quality > 100) quality = 100;

  const char* status;
  if (millis() - bootAt < WARMUP_MS)      status = "warming up";
  else if (quality >= 70)                 status = "Good";
  else if (quality >= 45)                 status = "Moderate";
  else                                    status = "Poor";

  char payload[200];
  snprintf(payload, sizeof(payload),
           "{\"location\":\"%s\",\"raw_adc\":%d,\"voltage\":%.3f,\"quality_percent\":%.2f,\"status\":\"%s\"}",
           LOCATION, raw, voltage, quality, status);

  Serial.printf("[pub] %s\n", payload);   // эту строку читает бэкенд в режиме USB

  if (USB_ONLY) return;
  if (!mqtt.connected()) {
    log("[pub] SKIP: нет соединения с MQTT");
    return;
  }
  bool ok = mqtt.publish(MQTT_TOPIC, payload);   // qos 0
  Serial.printf("[pub] %s\n", ok ? "sent" : "FAILED");
}
