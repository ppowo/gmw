import prompts from 'prompts';

/**
 * Simple confirmation prompt
 */
export async function confirm(message) {
  const response = await prompts({
    type: 'confirm',
    name: 'value',
    message,
    initial: false
  });
  return response.value ?? false;
}
