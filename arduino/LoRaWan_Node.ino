#ifndef GPIO_IS_VALID_GPIO
#define GPIO_IS_VALID_GPIO(pin) ((pin) < 48)
#endif

#include "LoRaWan_APP.h"
#include <OneWire.h>
#include <DallasTemperature.h>

/* OTAA para*/
uint8_t devEui[] = { 0xB2, 0x93, 0x2F, 0x1A, 0x7A, 0xCE, 0x24, 0x17 };
uint8_t appEui[] = { 0xED, 0x6A, 0x3B, 0xC5, 0x9C, 0x63, 0x49, 0x1F };
uint8_t appKey[] = { 0x9B, 0x91, 0xD4, 0x5E, 0xE8, 0xD0, 0x75, 0xAE, 0xF9, 0x0D, 0x3F, 0x1D, 0x5F, 0xA8, 0x83, 0x5E };

/* ABP para*/
uint8_t nwkSKey[] = { 0x15, 0xb1, 0xd0, 0xef, 0xa4, 0x63, 0xdf, 0xbe, 0x3d, 0x11, 0x18, 0x1e, 0x1e, 0xc7, 0xda,0x85 };
uint8_t appSKey[] = { 0xd7, 0x2c, 0x78, 0x75, 0x8c, 0xdc, 0xca, 0xbf, 0x55, 0xee, 0x4a, 0x77, 0x8d, 0x16, 0xef,0x67 };
uint32_t devAddr =  ( uint32_t )0x007e6ae1;

/*LoraWan channelsmask, default channels 0-7*/ 
uint16_t userChannelsMask[6]={ 0x00FF,0x0000,0x0000,0x0000,0x0000,0x0000 };

/*LoraWan region, select in arduino IDE tools*/
LoRaMacRegion_t loraWanRegion = ACTIVE_REGION;

/*LoraWan Class, Class A and Class C are supported*/
DeviceClass_t  loraWanClass = CLASS_A;

/*the application data transmission duty cycle.  value in [ms].*/
uint32_t appTxDutyCycle = 150000;

/*OTAA or ABP*/
bool overTheAirActivation = true;

/*ADR enable*/
bool loraWanAdr = true;

/* Indicates if the node is sending confirmed or unconfirmed messages */
bool isTxConfirmed = true;

/* Application port */
uint8_t appPort = 2;
/*!
* Number of trials to transmit the frame, if the LoRaMAC layer did not
* receive an acknowledgment. The MAC performs a datarate adaptation,
* according to the LoRaWAN Specification V1.0.2, chapter 18.4, according
* to the following table:
*
* Transmission nb | Data Rate
* ----------------|-----------
* 1 (first)       | DR
* 2               | DR
* 3               | max(DR-1,0)
* 4               | max(DR-1,0)
* 5               | max(DR-2,0)
* 6               | max(DR-2,0)
* 7               | max(DR-3,0)
* 8               | max(DR-3,0)
*
* Note, that if NbTrials is set to 1 or 2, the MAC will not decrease
* the datarate, in case the LoRaMAC layer did not receive an acknowledgment
*/
uint8_t confirmedNbTrials = 4;

/* Prepares the payload of the frame */
#define AOUT_MOISTURE_PIN 6
#define LIGHT_SENSOR_PIN 7
#define SENSOR_PIN 5
OneWire oneWire(SENSOR_PIN);
DallasTemperature DS18B20(&oneWire);
int tempC;

void setup() {
  Serial.begin(115200);
  Mcu.begin(HELTEC_BOARD,SLOW_CLK_TPYE);
  DS18B20.begin();
}

static void prepareTxFrame(uint8_t port)
{ 
    // Raw sensor reads
    DS18B20.requestTemperatures();
    tempC = DS18B20.getTempCByIndex(0);
    int rawMoisture = analogRead(AOUT_MOISTURE_PIN);
    int rawLight    = analogRead(LIGHT_SENSOR_PIN);
    int rawTemp = tempC * 9 / 5 + 32;




    // Validate readings
    bool moistureInvalid = (rawMoisture == 0 || rawMoisture == 4095);
    bool tempInvalid     = (rawTemp < -50 || rawTemp > 125);

    if (moistureInvalid) rawMoisture = 1234;
    if (tempInvalid)     rawTemp     = 89;

    //Higher the light number, the lower the light output.
    
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
    // ENCODE PAYLOAD (6 bytes)
    // -----------------------------
    // moistureState and lightState are small (0–3 and 0–1)
    // but we still encode them as 2 bytes each to keep your payload format stable.

    appData[0] = highByte(rawMoisture);
    appData[1] = lowByte(rawMoisture);

    appData[2] = highByte(rawLight);
    appData[3] = lowByte(rawLight);

    appData[4] = highByte(rawTemp);
    appData[5] = lowByte(rawTemp);

    appDataSize = 6;

    // -----------------------------
    // SERIAL DEBUG OUTPUT
    // -----------------------------
    Serial.print("Moisture Raw: ");
    Serial.print(rawMoisture);
    Serial.print(" | Moisture State: ");
    Serial.print(moistureState);

    Serial.print(" | Light Raw: ");
    Serial.print(rawLight);
    Serial.print(" | Light State: ");
    Serial.print('1');

    Serial.print(" | Temp Raw: ");
    Serial.println(rawTemp);
}

//if true, next uplink will add MOTE_MAC_DEVICE_TIME_REQ 



void loop()
{
  switch( deviceState )
  {
    case DEVICE_STATE_INIT:
    {
#if(LORAWAN_DEVEUI_AUTO)
      LoRaWAN.generateDeveuiByChipID();
#endif
      LoRaWAN.init(loraWanClass,loraWanRegion);
      //both set join DR and DR when ADR off 
      LoRaWAN.setDefaultDR(3);
      break;
    }
    case DEVICE_STATE_JOIN:
    {
      LoRaWAN.join();
      break;
    }
    case DEVICE_STATE_SEND:
    {
      prepareTxFrame( appPort );
      LoRaWAN.send();
      deviceState = DEVICE_STATE_CYCLE;
      break;
    }
    case DEVICE_STATE_CYCLE:
    {
      // Schedule next packet transmission
      txDutyCycleTime = appTxDutyCycle + randr( -APP_TX_DUTYCYCLE_RND, APP_TX_DUTYCYCLE_RND );
      LoRaWAN.cycle(txDutyCycleTime);
      deviceState = DEVICE_STATE_SLEEP;
      break;
    }
    case DEVICE_STATE_SLEEP:
    {
      LoRaWAN.sleep(loraWanClass);
      break;
    }
    default:
    {
      deviceState = DEVICE_STATE_INIT;
      break;
    }
  }
}
