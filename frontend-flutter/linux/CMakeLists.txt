cmake_minimum_required(VERSION 3.13)
project(tasknet LANGUAGES CXX)

set(BINARY_NAME "tasknet")
set(APPLICATION_ID "com.nagacentral.tasknet")

cmake_policy(SET CMP0063 NEW)

set(CMAKE_INSTALL_RPATH "$ORIGIN/lib")

# Configure build options.
if(NOT CMAKE_BUILD_TYPE AND NOT CMAKE_CONFIGURATION_TYPES)
  set(CMAKE_BUILD_TYPE "Debug" CACHE STRING "Flutter build mode" FORCE)
  set_property(CACHE CMAKE_BUILD_TYPE PROPERTY STRINGS "Debug" "Profile" "Release")
endif()

add_subdirectory(${FLUTTER_MANAGED_DIR} managed_flutter)
add_subdirectory(runner)

target_compile_definitions(${BINARY_NAME} PRIVATE "APPLICATION_ID=\"${APPLICATION_ID}\"")
