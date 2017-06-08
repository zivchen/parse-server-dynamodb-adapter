/// <reference path="../node_modules/mocha-typescript/globals.d.ts" />
import { suite, test, slow, timeout } from 'mocha-typescript';
import { should, expect, assert } from 'chai';
import { DynamoDB as DAdapter } from '../src/';
import { Partition, FilterExpression as Query } from '../src/DynamoPartition';
import { Adapter } from '../src/DynamoAdapter';
import { DynamoDB } from 'aws-sdk';

const AWS = require('aws-sdk-mock');

const __ops1 = ['$eq', '$ne', '$gt', '$gte', '$lt', '$lt', '$lte'];
const __ops2 = ['$exists'];

@suite class DDBQuery {

    @test 'DynamoDB FilterExpression : single query with single key'() {
        __ops1.forEach(
            op => {
                let exp = new Query();
                exp.build({ 
                    field : {
                        [op] : 1
                    }
                });

                expect(Object.keys(exp.ExpressionAttributeNames).length).to.be.equal(1);
                expect(Object.keys(exp.ExpressionAttributeValues).length).to.be.equal(1);
                expect(exp.ExpressionAttributeNames).to.haveOwnProperty('#field');
                expect(exp.ExpressionAttributeValues).to.haveOwnProperty(':field_0');
                expect(exp.ExpressionAttributeNames['#field']).to.be.equal('field');
                expect(exp.ExpressionAttributeValues[':field_0']).to.be.equal(1);
                expect(exp.FilterExpression).to.be.equal(
                    '#field [op] :field_0'.replace('[op]', exp.comperators[op])
                )
            }
        )
    }

    @test 'DynamoDB FilterExpression : range query of signle key'() {
        let exp = new Query();
        exp.build({
            balance : {
                $gt : 1000,
                $lt : 2000
            }
        });

        expect(Object.keys(exp.ExpressionAttributeNames).length).to.be.equal(1);
        expect(Object.keys(exp.ExpressionAttributeValues).length).to.be.equal(2);
        expect(exp.ExpressionAttributeNames).to.haveOwnProperty('#balance');
        expect(exp.ExpressionAttributeValues).to.haveOwnProperty(':balance_0');
        expect(exp.ExpressionAttributeValues).to.haveOwnProperty(':balance_1');
        expect(exp.ExpressionAttributeNames['#balance']).to.be.equal('balance');
        expect(exp.ExpressionAttributeValues[':balance_0']).to.be.equal(1000);
        expect(exp.ExpressionAttributeValues[':balance_1']).to.be.equal(2000);
        expect((exp.FilterExpression.match(/AND/g) || []).length).to.be.equal(1);
        expect(exp.FilterExpression).to.be.equal(
            '#balance > :balance_0 AND #balance < :balance_1'
        );
    }

    @test 'DynamoDB FilterExpression : range query of signle key with $and'() {
        let exp = new Query();
        exp.build({ $and : [
            { balance : { $gt : 1000 } },
            { balance : { $lt : 2000 } }
        ]});

        expect(Object.keys(exp.ExpressionAttributeNames).length).to.be.equal(1);
        expect(Object.keys(exp.ExpressionAttributeValues).length).to.be.equal(2);
        expect(exp.ExpressionAttributeNames).to.haveOwnProperty('#balance');
        expect(exp.ExpressionAttributeValues).to.haveOwnProperty(':balance_0');
        expect(exp.ExpressionAttributeValues).to.haveOwnProperty(':balance_1');
        expect(exp.ExpressionAttributeNames['#balance']).to.be.equal('balance');
        expect(exp.ExpressionAttributeValues[':balance_0']).to.be.equal(1000);
        expect(exp.ExpressionAttributeValues[':balance_1']).to.be.equal(2000);
        expect((exp.FilterExpression.match(/AND/g) || []).length).to.be.equal(1);
        expect(exp.FilterExpression).to.be.equal(
            '#balance > :balance_0 AND #balance < :balance_1'
        );
    }

    @test 'DynamoDB FilterExpression : nested $or query of $ands'() {
        let exp = new Query();
        exp.build({ $and : [
            { 
                $or : [
                    { balance : { $gt : 1000 } },
                    { balance : { $lt : 2000 } }
                ]
            },
            {
                $or : [
                    { quantity : { $ne : 0 } },
                    { quantity : { $ne : 5000 } }
                ]
            }
        ]});

        expect(Object.keys(exp.ExpressionAttributeNames).length).to.be.equal(2);
        expect(Object.keys(exp.ExpressionAttributeValues).length).to.be.equal(4);
        expect(exp.FilterExpression).to.be.equal(
            '( #balance > :balance_0 OR #balance < :balance_1 ) AND ( #quantity <> :quantity_0 OR #quantity <> :quantity_1 )'
        );
    }

    @test 'DynamoDB FilterExpression : $and query with multiple keys'() {
        let exp = new Query();
        exp.build({ $and : [
            { balance : { $gt : 1000 } },
            { balance : { $lt : 2000 } },
            { quantity : { $eq : 5 } },
            { product : 'book' }
        ]});

        expect(Object.keys(exp.ExpressionAttributeNames).length).to.be.equal(3);
        expect(Object.keys(exp.ExpressionAttributeValues).length).to.be.equal(4);
        expect((exp.FilterExpression.match(/AND/g) || []).length).to.be.equal(3);
        expect(exp.FilterExpression).to.be.equal(
            '#balance > :balance_0 AND #balance < :balance_1 AND #quantity = :quantity_0 AND #product = :product_0'
        );
    }

    @test 'DynamoDB FilterExpression : simple query with multiple keys without operator'() {
        let exp = new Query();
        exp.build({ 
            "string" : "string",
            "number" : 1,
            "date" : new Date().toISOString(),
            "double" : 1.5,
            "array" : [ 1, 2 ,3 ],
            "object" : {
                key1 : 'value1',
                key2 : 'value2'
            }
        });

        expect(Object.keys(exp.ExpressionAttributeNames).length).to.be.equal(6);
        expect(Object.keys(exp.ExpressionAttributeValues).length).to.be.equal(6);
        expect(Object.keys(exp.ExpressionAttributeNames).sort().join()).to.be.equal(
            ['#string','#number','#object','#array','#double','#date'].sort().join()
        )
        expect(Object.keys(exp.ExpressionAttributeValues).sort().join()).to.be.equal(
            [':string_0',':number_0',':object_0',':array_0',':double_0',':date_0'].sort().join()
        )
        expect((exp.FilterExpression.match(/AND/g) || []).length).to.be.equal(5);
        expect(exp.FilterExpression).to.be.equal(
            '#string [op] :string_0 AND #number [op] :number_0 AND #date [op] :date_0 AND #double [op] :double_0 AND #array = :array_0 AND #object = :object_0'.replace(/\[op\]/g, '=')
        )
    }

    @test 'DynamoDB FilterExpression : simple query with multiple keys'() {
        __ops1.forEach(
            op => {
                let exp = new Query();
                exp.build({ 
                    "string" : {
                        [op] : "string"
                    },
                    "number" : {
                        [op] : 1
                    },
                    "date" : {
                        [op] : (new Date()).toISOString()
                    },
                    "double" : {
                        [op] : 1.5
                    },
                    "array" : {
                        '$eq' : [1,2,3]
                    },
                    "object" : {
                        '$eq' : {
                            key1 : 'value2',
                            key2 : 'value2'
                         }
                    }
                });

                expect(Object.keys(exp.ExpressionAttributeNames).length).to.be.equal(6);
                expect(Object.keys(exp.ExpressionAttributeValues).length).to.be.equal(6);
                expect(Object.keys(exp.ExpressionAttributeNames).sort().join()).to.be.equal(
                    ['#string','#number','#object','#array','#double','#date'].sort().join()
                )
                expect(Object.keys(exp.ExpressionAttributeValues).sort().join()).to.be.equal(
                    [':string_0',':number_0',':object_0',':array_0',':double_0',':date_0'].sort().join()
                )
                expect((exp.FilterExpression.match(/AND/g) || []).length).to.be.equal(5);
                expect(exp.FilterExpression).to.be.equal(
                    '#string [op] :string_0 AND #number [op] :number_0 AND #date [op] :date_0 AND #double [op] :double_0 AND #array = :array_0 AND #object = :object_0'.replace(/\[op\]/g, exp.comperators[op])
                )
            }
        )
    }

    @test 'DynamoDB FilterExpression : $or query of signle key'() {
        let exp = new Query();
        exp.build({ $or : [
            { balance : { $gt : 1000, $ne : 5000 } },
            { balance : { $lt : 2000, $ne : 0 } },
        ]});

        expect(Object.keys(exp.ExpressionAttributeNames).length).to.be.equal(1);
        expect(Object.keys(exp.ExpressionAttributeValues).length).to.be.equal(4);
        expect(exp.ExpressionAttributeNames).to.haveOwnProperty('#balance');
        expect(exp.ExpressionAttributeNames['#balance']).to.be.equal('balance');
        expect(exp.ExpressionAttributeValues[':balance_0']).to.be.equal(1000);
        expect(exp.ExpressionAttributeValues[':balance_1']).to.be.equal(5000);
        expect(exp.ExpressionAttributeValues[':balance_2']).to.be.equal(2000);
        expect(exp.ExpressionAttributeValues[':balance_3']).to.be.equal(0);
        expect(exp.FilterExpression).to.be.equal(
            '( #balance > :balance_0 AND #balance <> :balance_1 ) OR ( #balance < :balance_2 AND #balance <> :balance_3 )'
        );
    }

    @test 'DynamoDB FilterExpression : nested complex $or query of $ands'() {
        let exp = new Query();
        exp.build({ $or : [
            { 
                $and : [
                    { balance : { $gt : 1000 } },
                    { balance : { $lt : 2000 } }
                ]
            },
            {
                $and : [
                    { quantity : { $ne : 0 } },
                    { quantity : { $ne : 5000 } },
                    { product : { $in : ['book', 'CD'] } },
                    { stat : { $nin : ['old', 'used'] } },
                    { author : { $not : { $ne : 'abc' } } },
                    { $or : [
                        { stars : 5 },
                        { stars : { $exists : 0 } }
                    ]}
                ]
            }
        ]});

        expect(Object.keys(exp.ExpressionAttributeNames).length).to.be.equal(6);
        expect(Object.keys(exp.ExpressionAttributeValues).length).to.be.equal(12);
        expect(exp.FilterExpression).to.be.equal(
            '#balance > :balance_0 AND #balance < :balance_1 OR #quantity <> :quantity_0 AND #quantity <> :quantity_1 AND #product IN (:product_0_0,:product_0_1) AND NOT ( #stat IN (:stat_0_0,:stat_0_1) ) AND #author = :author_0 AND ( #stars = :stars_0 OR attribute_not_exists(#stars) )'
        );
    }
}