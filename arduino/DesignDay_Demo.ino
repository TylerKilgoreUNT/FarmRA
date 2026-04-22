#ifndef GPIO_IS_VALID_GPIO
#define GPIO_IS_VALID_GPIO(pin) ((pin) < 48)
#endif

#include <OneWire.h>
#include <DallasTemperature.h>

#define AOUT_MOISTURE_PIN 6
#define LIGHT_SENSOR_PIN 7
#define SENSOR_PIN 5

OneWire oneWire(SENSOR_PIN);
DallasTemperature DS18B20(&oneWire);

int tempC;

void setup() {
  Serial.begin(115200);
  DS18B20.begin();
}

void loop() {

  // -----------------------------
  // READ SENSORS
  ------------------------------
  DS18B20.requestTemperatures();
  tempC = DS18B20.getTempCByIndex(0);

  int rawMoisture = analogRead(AOUT_MOISTURE_PIN);
  int rawLight    = analogRead(LIGHT_SENSOR_PIN);
  int rawTempF    = tempC * 9 / 5 + 32;

  // -----------------------------
  // VALIDATION
  ------------------------------
  bool moistureInvalid = (rawMoisture == 0 || rawMoisture == 4095);
  bool tempInvalid     = (rawTempF < -50 || rawTempF > 125);

  if (moistureInvalid) rawMoisture = 1234;
  if (tempInvalid)     rawTempF    = 89;

  // -----------------------------
  // MOISTURE STATE LOGIC
  //------------------------------
  int moistureState = 0;

  if (rawMoisture <= 1900) {
      moistureState = 0;   // too wet
  } else if (rawMoisture <= 2250) {
      moistureState = 1;   // perfect
  } else if (rawMoisture <= 2450) {
      moistureState = 2;   // needs water
  } else {
      moistureState = 3;   // no water
  }

  // -----------------------------
  // SERIAL OUTPUT ONLY
  // -----------------------------
  Serial.println("----- SENSOR READINGS -----");

  Serial.print("Moisture Raw: ");
  Serial.print(rawMoisture);
  Serial.print(" | Moisture State: ");
  Serial.println(moistureState);

  Serial.print("Light Raw: ");
  Serial.println(rawLight);

  Serial.print("Temperature: ");
  Serial.print(tempC);
  Serial.print(" °C  ~  ");
  Serial.print(rawTempF);
  Serial.println(" °F");

  Serial.println("---------------------------\n");

  delay(1000);
}
