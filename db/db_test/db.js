const cassandra = require('cassandra-driver');

const client = new cassandra.Client({
  contactPoints: ['10.176.67.88:9042'],
  localDataCenter: 'datacenter1',
  keyspace: 'pimin_net'
});

const query = 'select * from users';

client.execute(query)
  .then(result => console.log('Username:  %s', result.rows[0].user_name));
