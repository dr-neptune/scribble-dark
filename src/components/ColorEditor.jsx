import React, { useState, useEffect, useCallback } from 'react';
import {
  ColorPicker,
  Text,
  Select,
  Group,
  Title,
  Stack,
  Notification,
  Flex,
  Box,
  ActionIcon,
  UnstyledButton,
} from '@mantine/core';
import { IconCheck, IconX, IconTrash } from '@tabler/icons-react';
import debounce from 'lodash.debounce';

function ColorEditor() {
  // Define icon properties
  const iconProps = {
    stroke: 1.5,
    color: 'currentColor',
    opacity: 0.6,
    size: 18,
  };

  const [selectedAttribute, setSelectedAttribute] = useState(null);
  const [colors, setColors] = useState({});
  const [colorPropertiesData, setColorPropertiesData] = useState(null);
  const [notification, setNotification] = useState({
    show: false,
    success: true,
    message: '',
  });
  const [reloadTrigger, setReloadTrigger] = useState(0); // To trigger iframe reload
  const [recentColors, setRecentColors] = useState([]); // To store recently used colors

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:5001'); // WebSocket server address

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'update') {
        console.log('Received update notification');
        // Trigger iframe reload
        setReloadTrigger((prev) => prev + 1);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Fetch color-properties.json and existing dark-mode-colors.json on initial load
  useEffect(() => {
    // Fetch color-properties.json
    fetch('/color-properties.json')
      .then((response) => response.json())
      .then((data) => setColorPropertiesData(data))
      .catch((error) => {
        console.error('Error fetching color-properties.json:', error);
        setNotification({
          show: true,
          success: false,
          message: 'Failed to load color properties.',
        });
      });

    // Fetch dark-mode-colors.json to initialize colors state
    fetch('/dark-mode-colors.json')
      .then((response) => {
        if (response.ok) return response.json();
        else return {}; // If file doesn't exist, start with empty colors
      })
      .then((data) => setColors(data))
      .catch((error) => {
        console.error('Error fetching dark-mode-colors.json:', error);
        setNotification({
          show: true,
          success: false,
          message: 'Failed to load existing colors.',
        });
      });
  }, []);

  // Generate options for the Select component
  const generateOptions = () => {
    if (!colorPropertiesData) return [];
    const options = [];
    Object.entries(colorPropertiesData).forEach(([file, selectors]) => {
      Object.entries(selectors).forEach(([selector, properties]) => {
        properties.forEach((property) => {
          const optionValue = `${file}||${selector}||${property}`;
          const label = `${file} > ${selector} > ${property}`;
          options.push({ value: optionValue, label });
        });
      });
    });
    return options;
  };

  // Debounced save function with increased debounce duration (e.g., 2000ms)
  const debouncedSave = useCallback(
    debounce((updatedColors) => {
      // Send the colors state to the backend server
      fetch('http://localhost:5000/save-colors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedColors),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.message === 'Colors saved successfully.') {
            setNotification({
              show: true,
              success: true,
              message: 'Colors saved successfully!',
            });
          } else {
            setNotification({
              show: true,
              success: false,
              message: 'Failed to save colors.',
            });
          }
        })
        .catch((error) => {
          console.error('Error saving colors:', error);
          setNotification({
            show: true,
            success: false,
            message: 'An error occurred while saving colors.',
          });
        });
    }, 2000), // Increased debounce to 2000ms
    []
  );

  const handleColorChange = (newColor) => {
    if (selectedAttribute) {
      const [file, selector, property] = selectedAttribute.split('||');
      setColors((prev) => {
        const updatedColors = {
          ...prev,
          [file]: {
            ...(prev[file] || {}),
            [selector]: {
              ...(prev[file]?.[selector] || {}),
              [property]: newColor,
            },
          },
        };
        debouncedSave(updatedColors);

        // Update recentColors only if the color is not already in the palette
        setRecentColors((prevRecent) => {
          if (prevRecent.includes(newColor)) {
            // If the color already exists, move it to the front
            const updatedRecent = [newColor, ...prevRecent.filter((c) => c !== newColor)];
            return updatedRecent;
          } else {
            // Add the new color to the front
            const updatedRecent = [newColor, ...prevRecent];
            return updatedRecent.slice(0, 8); // Keep only the 8 most recent colors
          }
        });

        return updatedColors;
      });
    }
  };

  // Handle clicking on a color item in the sidebar
  const handleColorItemClick = (attribute) => {
    setSelectedAttribute(attribute);
  };

  // Handle removing a color
  const handleRemoveColor = (attribute) => {
    const [file, selector, property] = attribute.split('||');
    setColors((prev) => {
      const updatedFile = { ...prev[file] };
      if (updatedFile[selector]) {
        delete updatedFile[selector][property];
        // Clean up if no properties left
        if (Object.keys(updatedFile[selector]).length === 0) {
          delete updatedFile[selector];
        }
      }
      const updatedColors = { ...prev, [file]: updatedFile };
      debouncedSave(updatedColors);
      return updatedColors;
    });
    setNotification({
      show: true,
      success: true,
      message: 'Color removed successfully!',
    });
  };

  return (
    <Flex>
      {/* Editor Box */}
      <Box
        style={{
          width: '35%',
          padding: '1rem',
          overflowY: 'auto',
          borderRight: '1px solid #ddd',
          height: '100vh',
        }}
      >
        <Title order={3} mb="md">
          Dark Mode Theme Editor
        </Title>
        <Stack spacing="md">
          <Select
            label="Select Attribute"
            placeholder="Choose an attribute"
            data={generateOptions()}
            value={selectedAttribute}
            onChange={setSelectedAttribute}
            searchable
            nothingFound="No attributes found"
            renderOption={({ option, checked }) => (
              <Group flex="1" gap="xs">
                <Text>{option.label}</Text>
                {checked && <IconCheck style={{ marginLeft: 'auto' }} {...iconProps} />}
              </Group>
            )}
          />
          {selectedAttribute && (
            <>
              <Text size="sm" weight={500}>
                Selected Attribute: {selectedAttribute.replace(/\|\|/g, ' > ')}
              </Text>
              <ColorPicker
                format="rgba"
                value={
                  (() => {
                    const [file, selector, property] = selectedAttribute.split('||');
                    return colors[file]?.[selector]?.[property] || '#000000';
                  })()
                }
                onChange={handleColorChange}
                swatches={[
                  '#000000',
                  '#ffffff',
                  '#ff0000',
                  '#00ff00',
                  '#0000ff',
                  '#ffff00',
                  '#ff00ff',
                  '#00ffff',
                  // Add recent colors at the end to prevent priority over predefined swatches
                  ...recentColors.filter((color) => !['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'].includes(color)),
                ]}
                swatchesPerRow={8}
              />
            </>
          )}
          {/* Display the list of selected colors */}
          {Object.keys(colors).length > 0 && (
            <>
              <Title order={4} mt="xl" mb="sm">
                Selected Colors
              </Title>
              {Object.entries(colors).map(([file, selectors]) =>
                Object.entries(selectors).map(([selector, properties]) =>
                  Object.entries(properties).map(([property, color]) => {
                    const attribute = `${file}||${selector}||${property}`;
                    const isSelected = selectedAttribute === attribute;
                    return (
                      <UnstyledButton
                        key={attribute}
                        onClick={() => handleColorItemClick(attribute)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          borderRadius: '4px',
                          backgroundColor: isSelected ? '#f0f0f0' : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <Group position="apart" noWrap>
                          <Group>
                            <Text>
                              <strong>{file}</strong> &gt;{' '}
                              <strong>{selector}</strong> &gt;{' '}
                              <strong>{property}</strong>
                            </Text>
                          </Group>
                          <Group spacing="xs">
                            <ActionIcon
                              variant="filled"
                              aria-label="Color Indicator"
                              style={{
                                backgroundColor: color,
                                width: '24px',
                                height: '24px',
                              }}
                            >
                              {/* Optional: Add an icon inside if desired */}
                            </ActionIcon>
                            <ActionIcon
                              variant="light"
                              color="red"
                              aria-label="Remove Color"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering the parent click
                                handleRemoveColor(attribute);
                              }}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Group>
                        </Group>
                      </UnstyledButton>
                    );
                  })
                )
              )}
            </>
          )}
        </Stack>
        {/* Notification */}
        {notification.show && (
          <Notification
            icon={notification.success ? <IconCheck size={18} /> : <IconX size={18} />}
            color={notification.success ? 'teal' : 'red'}
            title={notification.success ? 'Success' : 'Error'}
            onClose={() => setNotification({ ...notification, show: false })}
            disallowClose
            style={{ marginTop: '1rem' }}
          >
            {notification.message}
          </Notification>
        )}
      </Box>
      {/* Iframe Box */}
      <Box style={{ width: '65%', height: '100vh' }}>
        <iframe
          key={reloadTrigger} // Changing key forces iframe to reload
          src="/pairs-and-lists/4.10 Pairs and Lists.html"
          title="Content"
          style={{
            width: '1000px',
            height: '100%',
            border: 'none',
            marginTop: '2rem',
          }}
        ></iframe>
      </Box>
    </Flex>
  );
}

export default ColorEditor;
