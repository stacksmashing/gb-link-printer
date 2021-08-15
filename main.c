/* 
 * The MIT License (MIT)
 *
 * Copyright (c) 2019 Ha Thach (tinyusb.org)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 */

#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#include "bsp/board.h"
// #include "tusb.h"
// #include "usb_descriptors.h"
#include <stdio.h>
#include <string.h>
// #include "tusb.h"
//#include "hardware/pio.h"
//#include "pio/pio_spi.h"
#include "hardware/gpio.h"
//const uint SI_PIN = 3;
//--------------------------------------------------------------------+
// MACRO CONSTANT TYPEDEF PROTYPES
//--------------------------------------------------------------------+

/* Blink pattern
 * - 250 ms  : device not mounted
 * - 1000 ms : device mounted
 * - 2500 ms : device is suspended
 */
enum  {
  BLINK_NOT_MOUNTED = 250,
  BLINK_MOUNTED     = 1000,
  BLINK_SUSPENDED   = 2500,

  BLINK_ALWAYS_ON   = UINT32_MAX,
  BLINK_ALWAYS_OFF  = 0
};

// static uint32_t blink_interval_ms = BLINK_NOT_MOUNTED;

// #define URL  "tetris.stacksmashing.net"

// const tusb_desc_webusb_url_t desc_url =
// {
//   .bLength         = 3 + sizeof(URL) - 1,
//   .bDescriptorType = 3, // WEBUSB URL type
//   .bScheme         = 1, // 0: http, 1: https
//   .url             = URL
// };

static bool web_serial_connected = false;

//------------- prototypes -------------//
void led_blinking_task(void);
void cdc_task(void);
void webserial_task(void);

/*------------- MAIN -------------*/

//  pio_spi_inst_t spi = {
//          .pio = pio1,
//          .sm = 0
//  };


#define PIN_SCK 0
#define PIN_SIN 1
#define PIN_SOUT 2



enum printer_state {
  GB_WAIT_FOR_SYNC_1,
  GB_WAIT_FOR_SYNC_2,
  GB_COMMAND,
  GB_COMPRESSION_INDICATOR,
  GB_LEN_LOWER,
  GB_LEN_HIGHER,
  GB_DATA,
  GB_CHECKSUM_1,
  GB_CHECKSUM_2,
  GB_DEVICE_ID,
  GB_STATUS
};

//void send_byte(uint8_t b) {
//  gpio_put(PIN_SCK, 1);
//  gpio_set_dir(PIN_SCK, GPIO_OUT);
//  
//  for(int i=0; i < 8; i++) {
//    gpio_put(PIN_SOUT, b & 0x1);
//    gpio_put(PIN_SCK, 0);
//    sleep_us(64);
//    gpio_put(PIN_SCK, 1);
//    sleep_us(64);
//    b = b >> 1;
//  }
//  gpio_set_dir(PIN_SCK, GPIO_IN);
//}

char data[30*1024];
char params[4];

int main(void)
{
  enum printer_state state = GB_WAIT_FOR_SYNC_1;
  stdio_init_all();

  gpio_init(PIN_SCK);
  gpio_init(PIN_SIN);
  gpio_init(PIN_SOUT);
  gpio_init(25);

  gpio_set_dir(PIN_SCK, GPIO_IN);
  gpio_set_dir(PIN_SIN, GPIO_IN);
  gpio_set_dir(PIN_SOUT, GPIO_OUT);
  gpio_set_dir(25, GPIO_OUT);
  gpio_put(PIN_SOUT, 0);
  gpio_put(25, 0);

  printf("Main loop\n");

  uint8_t received_data = 0;
  uint8_t received_bits = 0;
  uint8_t send_data = 0;

  uint8_t command = 0;
  uint8_t compression_indicator = 0;
  uint16_t length = 0;
  uint16_t checksum = 0;
  bool synced = false;
  
  uint16_t received_bytes = 0;
  uint16_t received_bytes_counter = 0;
  while(1) {

    gpio_put(25, synced);

    // wait for clk to go low
    while(gpio_get(PIN_SCK)) {};
    gpio_put(PIN_SOUT, send_data & 0x1);
    send_data = send_data >> 1;
    // clk is low, wait for high to sample
    while(!gpio_get(PIN_SCK)) {};

    received_data = (received_data << 1) | (gpio_get(PIN_SIN) & 0x1);

    if(synced == false) {
      if(received_data != 0x88) {
        continue;
      } else {
        received_bits = 8;
      }
    } else {
      received_bits += 1;
    }
    synced = true;
    


    
    if(received_bits != 8) {
      continue;
    }
    // printf("DATA: %02x\n", received_data);
    // printf("%d\n", state);
    switch(state) {
      case GB_WAIT_FOR_SYNC_1:
        if(received_data == 0x88) {
          state = GB_WAIT_FOR_SYNC_2;
          send_data = 0;
        }
        break;
      case GB_WAIT_FOR_SYNC_2:
        if(received_data == 0x33) {
          // printf("Receiving command\n");
          state = GB_COMMAND;
          send_data = 0;
        } else {
          state = GB_WAIT_FOR_SYNC_1;
          synced = false;
        }
        break;
      case GB_COMMAND:
        command = received_data;
        state = GB_COMPRESSION_INDICATOR;
        if(command == 1) {
          received_bytes = 0;
        }
        break;
      case GB_COMPRESSION_INDICATOR:
        compression_indicator = received_data;
        state = GB_LEN_LOWER;
        break;
      case GB_LEN_LOWER:
        length = received_data & 0xff;
        state = GB_LEN_HIGHER;
        break;
      case GB_LEN_HIGHER:
        length = length | ((uint16_t)received_data << 8);
        if(length > 0) {
          state = GB_DATA;
        } else {
          state = GB_CHECKSUM_1;
        }
        
        received_bytes_counter = 0;
        
        break;
      case GB_DATA:
        // printf("LEN %d\n", length);
        if (command == 2) {
          params[received_bytes_counter] = received_data;
        } else {
          data[received_bytes] = received_data;
          received_bytes++;
        }
        received_bytes_counter++;
        if(length == received_bytes_counter) {
          state = GB_CHECKSUM_1;
        }
        break;
      case GB_CHECKSUM_1:
        checksum = received_data;
        state = GB_CHECKSUM_2;
        break;
      case GB_CHECKSUM_2:
        checksum = checksum | ((uint16_t)received_data << 8);
        
        state = GB_DEVICE_ID;
        send_data = 0x81;
        // send_byte(0x81);
        // send_byte(0x0);
        // synced = false;
        // state = GB_WAIT_FOR_SYNC_1;
        break;
      case GB_DEVICE_ID:
        // send_byte(0x81);
        // send_byte(0x0);
        send_data = (command == 1) ? 0x0 : 0x10;  // Bits must be reversed because data is expected most-significant-bit first (0x10 outputs as 0x08)
        state = GB_STATUS;
        // synced = false;
        break;
      case GB_STATUS:
        state = GB_WAIT_FOR_SYNC_1;
        synced = false;
        send_data = 0x0;
        
        printf("DONE %d\n", command);
        printf("Command: %d\n", command);
        printf("Compression: %d\n", compression_indicator);
        printf("Length: %d\n", length);

        if(command == 2) {
          printf("PARAMS ");
          for(int i=0; i < length; i++) {
            printf("%02X ", params[i]);
          }
          printf("\nFIN\n");
          printf("PRINT ");
          for(int i=0; i < received_bytes; i++) {
            printf("%02X ", data[i]);
          }
          printf("\nFIN\n");
        }

        break;
      default:
        printf("INVALID STATE HELP\n");
        break;
    }
    
    received_data = 0;
    received_bits = 0;



    // printf("SCK: %d\n", gpio_get(PIN_SCK));
  }

  // uint cpha1_prog_offs = pio_add_program(spi.pio, &spi_cpha1_program);
  // pio_spi_init(spi.pio, spi.sm, cpha1_prog_offs, 8, 4058.838, 1, 1, PIN_SCK, PIN_SOUT, PIN_SIN);

  // tusb_init();

  // while (1)
  // {
  //   tud_task(); // tinyusb device task
  //   cdc_task();
  //   webserial_task();
  //   led_blinking_task();
  // }

  return 0;
}
// send characters to both CDC and WebUSB
void echo_all(uint8_t buf[], uint32_t count)
{
  // echo to web serial
  if ( web_serial_connected )
  {
    tud_vendor_write(buf, count);
  }

  // echo to cdc
  if ( tud_cdc_connected() )
  {
    for(uint32_t i=0; i<count; i++)
    {
      tud_cdc_write_char(buf[i]);

      if ( buf[i] == '\r' ) tud_cdc_write_char('\n');
    }
    tud_cdc_write_flush();
  }
}

// //--------------------------------------------------------------------+
// // Device callbacks
// //--------------------------------------------------------------------+

// // Invoked when device is mounted
// void tud_mount_cb(void)
// {
//   blink_interval_ms = BLINK_MOUNTED;
// }

// // Invoked when device is unmounted
// void tud_umount_cb(void)
// {
//   blink_interval_ms = BLINK_NOT_MOUNTED;
// }

// // Invoked when usb bus is suspended
// // remote_wakeup_en : if host allow us  to perform remote wakeup
// // Within 7ms, device must draw an average of current less than 2.5 mA from bus
// void tud_suspend_cb(bool remote_wakeup_en)
// {
//   (void) remote_wakeup_en;
//   blink_interval_ms = BLINK_SUSPENDED;
// }

// // Invoked when usb bus is resumed
// void tud_resume_cb(void)
// {
//   blink_interval_ms = BLINK_MOUNTED;
// }

// //--------------------------------------------------------------------+
// // WebUSB use vendor class
// //--------------------------------------------------------------------+

// // Invoked when received VENDOR control request
// bool tud_vendor_control_request_cb(uint8_t rhport, tusb_control_request_t const * request)
// {
//   switch (request->bRequest)
//   {
//     case VENDOR_REQUEST_WEBUSB:
//       // match vendor request in BOS descriptor
//       // Get landing page url
//       return tud_control_xfer(rhport, request, (void*) &desc_url, desc_url.bLength);

//     case VENDOR_REQUEST_MICROSOFT:
//       if ( request->wIndex == 7 )
//       {
//         // Get Microsoft OS 2.0 compatible descriptor
//         uint16_t total_len;
//         memcpy(&total_len, desc_ms_os_20+8, 2);

//         return tud_control_xfer(rhport, request, (void*) desc_ms_os_20, total_len);
//       }else
//       {
//         return false;
//       }

//     case 0x22:
//       // Webserial simulate the CDC_REQUEST_SET_CONTROL_LINE_STATE (0x22) to
//       // connect and disconnect.
//       web_serial_connected = (request->wValue != 0);

//       // Always lit LED if connected
//       if ( web_serial_connected )
//       {
//         board_led_write(true);
//         blink_interval_ms = BLINK_ALWAYS_ON;

//         // tud_vendor_write_str("\r\nTinyUSB WebUSB device example\r\n");
//       }else
//       {
//         blink_interval_ms = BLINK_MOUNTED;
//       }

//       // response with status OK
//       return tud_control_status(rhport, request);

//     default:
//       // stall unknown request
//       return false;
//   }

//   return true;
// }

// // Invoked when DATA Stage of VENDOR's request is complete
// bool tud_vendor_control_complete_cb(uint8_t rhport, tusb_control_request_t const * request)
// {
//   (void) rhport;
//   (void) request;

//   // nothing to do
//   return true;
// }

// void webserial_task(void)
// {
//   if ( web_serial_connected )
//   {
//     if ( tud_vendor_available() )
//     {
//       uint8_t buf[1];
//       uint32_t count = tud_vendor_read(buf, sizeof(buf));
//       if(count) {
//         // pprintf("Sending: %02x", buf[0]);
//         unsigned char rx;
//         pio_spi_write8_read8_blocking(&spi, buf, &rx, 1);
//         echo_all(&rx, 1);
//       }
//       // echo back to both web serial and cdc
//       // echo_all(buf, count);
//     }
//   }
// }


// //--------------------------------------------------------------------+
// // USB CDC
// //--------------------------------------------------------------------+
// void cdc_task(void)
// {
//   if ( tud_cdc_connected() )
//   {
//     // connected and there are data available
//     if ( tud_cdc_available() )
//     {
      
//       uint8_t buf[1];
//       uint32_t count = tud_vendor_read(buf, sizeof(buf));
//       if(count) {
//         unsigned char rx;
//         pio_spi_write8_read8_blocking(&spi, buf, &rx, 1);
//         echo_all(&rx, 1);
//       }
//       // echo back to both web serial and cdc
//       // echo_all(buf, count);
    
//       // uint8_t buf[64];

//       // uint32_t count = tud_cdc_read(buf, sizeof(buf));

//       // // echo back to both web serial and cdc
//       // echo_all(buf, count);
//     }
//   }
// }

// // Invoked when cdc when line state changed e.g connected/disconnected
// void tud_cdc_line_state_cb(uint8_t itf, bool dtr, bool rts)
// {
//   (void) itf;

//   // connected
//   if ( dtr && rts )
//   {
//     // print initial message when connected
//     // tud_cdc_write_str("\r\nTinyUSB WebUSB device example\r\n");
//   }
// }

// // Invoked when CDC interface received data from host
// void tud_cdc_rx_cb(uint8_t itf)
// {
//   (void) itf;
// }

// //--------------------------------------------------------------------+
// // BLINKING TASK
// //--------------------------------------------------------------------+
// void led_blinking_task(void)
// {
//   static uint32_t start_ms = 0;
//   static bool led_state = false;

//   // Blink every interval ms
//   if ( board_millis() - start_ms < blink_interval_ms) return; // not enough time
//   start_ms += blink_interval_ms;

//   board_led_write(led_state);
//   led_state = 1 - led_state; // toggle
// }
