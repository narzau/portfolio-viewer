
async function seed() {
  console.log('🌱 Starting database seed...');

  
  console.log('✅ Seed completed successfully!');
}

// Run the seed function
seed()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  }); 