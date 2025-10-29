import { createServerFn } from '@tanstack/react-start'
import { prisma } from '../lib/prisma'

export const getGuitars = createServerFn({ method: 'GET' }).handler(
  async () => {
    return await prisma.guitar.findMany({
      orderBy: { id: 'asc' },
    })
  }
)

export const getGuitarById = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const guitar = await prisma.guitar.findUnique({
      where: { id: parseInt(id, 10) },
    })
    return guitar
  })

export const getRandomGuitar = createServerFn({ method: 'GET' }).handler(
  async () => {
    const guitars = await prisma.guitar.findMany()
    if (guitars.length === 0) return null
    const randomIndex = Math.floor(Math.random() * guitars.length)
    return guitars[randomIndex]
  }
)
