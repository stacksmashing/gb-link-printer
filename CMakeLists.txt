cmake_minimum_required(VERSION 3.13)
# initialize the SDK based on PICO_SDK_PATH
# note: this must happen before project()
include(pico_sdk_import.cmake)
project(gb_link_printer)
 
pico_sdk_init()

add_executable(gb_link_printer)

pico_generate_pio_header(gb_link_printer ${CMAKE_CURRENT_LIST_DIR}/pio/spi.pio)

# target_include_directories(gbusb PRIVATE ${CMAKE_CURRENT_LIST_DIR})

target_sources(gb_link_printer PRIVATE
        main.c
        )
        
target_link_libraries(gb_link_printer PRIVATE pico_stdlib pico_stdio pico_stdlib pico_multicore pico_time pico_sync hardware_pio) # tinyusb_device tinyusb_board)
pico_add_extra_outputs(gb_link_printer)

pico_enable_stdio_usb(gb_link_printer 1)
pico_enable_stdio_uart(gb_link_printer 0)
