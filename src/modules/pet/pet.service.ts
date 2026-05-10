import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PetService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dynamically calculates pet state (hunger/sleepiness) based on time elapsed.
   */
  async getPetState(coupleId: string) {
    let pet = await this.prisma.pet.findUnique({
      where: { coupleId },
    });

    if (!pet) {
      // Create pet if it doesn't exist
      pet = await this.prisma.pet.create({
        data: {
          coupleId,
        },
      });
    }

    const now = new Date();
    
    // Hunger decays to 0 over 12 hours (43200000 ms)
    // 100 points / 12 hours
    const msSinceFed = now.getTime() - pet.lastFedAt.getTime();
    const hungerDecay = Math.floor((msSinceFed / 43200000) * 100);
    const currentHunger = Math.max(0, pet.hunger - hungerDecay);

    // Happiness decays over 24 hours (86400000 ms)
    const msSincePetted = now.getTime() - pet.lastPettedAt.getTime();
    const happinessDecay = Math.floor((msSincePetted / 86400000) * 100);
    const currentHappiness = Math.max(0, pet.happiness - happinessDecay);

    // Sleepiness increases over 16 hours awake (57600000 ms)
    const msSinceSlept = now.getTime() - pet.lastSleptAt.getTime();
    let currentSleepiness = pet.state === 'SLEEPING' ? 0 : Math.min(100, pet.sleepiness + Math.floor((msSinceSlept / 57600000) * 100));

    // Determine state overrides
    let currentState = pet.state;
    if (currentState !== 'SLEEPING' && currentState !== 'EATING') {
      if (currentHunger <= 20) currentState = 'HUNGRY';
      else if (currentHappiness <= 20) currentState = 'SAD';
      else if (currentSleepiness >= 80) currentState = 'SLEEPY';
      else currentState = 'IDLE';
    }

    return {
      ...pet,
      hunger: currentHunger,
      happiness: currentHappiness,
      sleepiness: currentSleepiness,
      state: currentState
    };
  }

  async feedPet(coupleId: string) {
    const pet = await this.getPetState(coupleId);
    return await this.prisma.pet.update({
      where: { id: pet.id },
      data: {
        hunger: 100,
        state: 'EATING',
        lastFedAt: new Date(),
      },
    });
  }

  async patPet(coupleId: string) {
    const pet = await this.getPetState(coupleId);
    return await this.prisma.pet.update({
      where: { id: pet.id },
      data: {
        happiness: 100,
        state: 'HAPPY',
        lastPettedAt: new Date(),
      },
    });
  }

  async toggleSleep(coupleId: string) {
    const pet = await this.getPetState(coupleId);
    const isSleeping = pet.state === 'SLEEPING';
    
    return await this.prisma.pet.update({
      where: { id: pet.id },
      data: {
        state: isSleeping ? 'IDLE' : 'SLEEPING',
        sleepiness: isSleeping ? 0 : pet.sleepiness,
        lastSleptAt: new Date(),
      },
    });
  }
}
