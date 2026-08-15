import { op, jsonBody, idParam } from '../helpers.js';

export function recipesPaths() {
  return {
    '/api/v1/recipes': {
      get: op({ summary: 'List recipes', tag: 'Recipes' }),
      post: op({ summary: 'Create recipe', tag: 'Recipes', stateChanging: true, requestBody: jsonBody(null) }),
    },
    '/api/v1/recipes/{id}': {
      put: op({ summary: 'Update recipe', tag: 'Recipes', params: [idParam()], stateChanging: true, requestBody: jsonBody(null) }),
      delete: op({ summary: 'Delete recipe', tag: 'Recipes', params: [idParam()], stateChanging: true }),
    },
    '/api/v1/recipes/{id}/to-shopping-list': {
      post: op({ summary: 'Transfer recipe ingredients to shopping list', description: 'Body may include an optional ingredientIds array to transfer only a subset (filtered to this recipe); omitted/empty transfers all ingredients.', tag: 'Recipes', params: [idParam()], stateChanging: true, requestBody: jsonBody(null) }),
    },
  };
}
