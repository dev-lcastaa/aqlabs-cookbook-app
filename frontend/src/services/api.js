const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (response.status === 204) {
    return null
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const errorMessage = data?.detail || 'Request failed'
    throw new Error(errorMessage)
  }

  return data
}

async function requestForm(path, formData, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'POST',
    body: formData,
    ...(options || {}),
  })

  if (response.status === 204) {
    return null
  }

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const errorMessage = data?.detail || 'Request failed'
    throw new Error(errorMessage)
  }

  return data
}

export const api = {
  listCookbooks() {
    return request('/cookbooks')
  },
  getCookbook(cookbookId) {
    return request(`/cookbooks/${cookbookId}`)
  },
  createCookbook(payload) {
    return request('/cookbooks', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  updateCookbook(cookbookId, payload) {
    return request(`/cookbooks/${cookbookId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  deleteCookbook(cookbookId) {
    return request(`/cookbooks/${cookbookId}`, {
      method: 'DELETE',
    })
  },
  listRecipes(cookbookId) {
    if (!cookbookId) {
      return request('/recipes')
    }
    return request(`/recipes?cookbook_id=${cookbookId}`)
  },
  createRecipe(payload) {
    return request('/recipes', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },
  updateRecipe(recipeId, payload) {
    return request(`/recipes/${recipeId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    })
  },
  deleteRecipe(recipeId) {
    return request(`/recipes/${recipeId}`, {
      method: 'DELETE',
    })
  },
  parseRecipeFromImages(formData) {
    return requestForm('/recipes/parse-from-images', formData, {
      method: 'POST',
    })
  },
}
